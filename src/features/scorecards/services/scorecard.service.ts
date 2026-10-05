import { z } from "zod";
import { updateScorecardSchema } from "@/features/scorecards/schemas";
import { HEALTH_BAND_ORDER, LIFECYCLE_WEIGHTING_NOTES, type HealthBandKey, type LifecycleStageName } from "@/config/health";
import { toListItem } from "@/features/accounts/services/account.service";
import { listAccountRows } from "@/features/accounts/repositories/account.repository";
import { recordAudit } from "@/features/audit/services/audit.service";
import { getHealthBand, validateBandThresholds, validateWeights } from "@/features/health/domain/score";
import { createScorecardVersion, getScorecardVersionHistory, listActiveScorecards, scorecardKey } from "@/features/health/repositories/health.repository";
import { recalculateHealthScores } from "@/features/health/services/health-calculation.service";
import { notifyUsers } from "@/features/notifications/services/notification.service";
import { db } from "@/lib/db/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";
import { toIsoDate } from "@/lib/utils/dates";

export async function getScorecardMatrix(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const [scorecards, rows] = await Promise.all([listActiveScorecards(db, ctx.organizationId), listAccountRows(db, ctx, { activeOnly: true })]);
  return scorecards.map((sc) => {
    const accounts = rows.filter((r) => scorecardKey(r.lifecycleStageId, r.segmentId) === scorecardKey(sc.lifecycleStageId, sc.segmentId));
    const avg = accounts.length ? Math.round(accounts.reduce((s, a) => s + (a.score ?? 0), 0) / accounts.length) : null;
    const bands = Object.fromEntries(HEALTH_BAND_ORDER.map((b) => [b, accounts.filter((a) => a.band === b).length])) as Record<HealthBandKey, number>;
    return {
      id: sc.scorecardId,
      name: sc.name,
      lifecycle: sc.lifecycle,
      segment: sc.segment,
      version: sc.version,
      accountCount: accounts.length,
      averageScore: avg,
      averageBand: avg === null ? null : getHealthBand(avg, sc.thresholds),
      bands,
      weights: sc.weights,
      thresholds: sc.thresholds,
    };
  });
}

export async function getScorecardDetail(ctx: ServiceContext, scorecardId: string) {
  assertPermission(ctx, "accounts.read");
  if (!z.string().uuid().safeParse(scorecardId).success) throw new NotFoundError("Scorecard");
  const scorecards = await listActiveScorecards(db, ctx.organizationId);
  const sc = scorecards.find((s) => s.scorecardId === scorecardId);
  if (!sc) throw new NotFoundError("Scorecard");
  const [rows, history] = await Promise.all([listAccountRows(db, ctx, { activeOnly: true }), getScorecardVersionHistory(db, ctx.organizationId, scorecardId)]);
  const now = new Date();
  const accounts = rows
    .filter((r) => r.lifecycleStageId === sc.lifecycleStageId && r.segmentId === sc.segmentId)
    .map((r) => toListItem(r, now))
    .sort((a, b) => a.score - b.score);
  return {
    scorecard: { ...sc, updatedAt: sc.updatedAt.toISOString(), note: LIFECYCLE_WEIGHTING_NOTES[sc.lifecycle as LifecycleStageName] ?? "" },
    accounts,
    history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
  };
}

/**
 * Saves a new scorecard version (weights + band thresholds), then recalculates
 * every account on that scorecard. Prior versions are retained for audit.
 */
export async function updateScorecard(ctx: ServiceContext, scorecardId: string, input: unknown) {
  assertPermission(ctx, "scorecards.manage");
  const values = parseInput(updateScorecardSchema, input);
  const weightCheck = validateWeights(values.weights);
  if (!weightCheck.valid) throw new ValidationError(weightCheck.errors[0], { fieldErrors: { weights: weightCheck.errors } });
  const bandCheck = validateBandThresholds(values.thresholds);
  if (!bandCheck.valid) throw new ValidationError(bandCheck.errors[0], { fieldErrors: { thresholds: bandCheck.errors } });
  if (values.effectiveFrom > toIsoDate(new Date(Date.now() + 365 * 86_400_000))) throw new ValidationError("Effective date must be within the next year.");

  const scorecards = await listActiveScorecards(db, ctx.organizationId);
  const sc = scorecards.find((s) => s.scorecardId === scorecardId);
  if (!sc) throw new NotFoundError("Scorecard");
  const rows = await listAccountRows(db, { organizationId: ctx.organizationId, segmentScope: [] }, {});
  const accountIds = rows.filter((r) => r.lifecycleStageId === sc.lifecycleStageId && r.segmentId === sc.segmentId).map((r) => r.id);

  return db.transaction(async (tx) => {
    const version = await createScorecardVersion(tx, {
      organizationId: ctx.organizationId,
      scorecardId,
      thresholds: values.thresholds,
      weights: values.weights,
      effectiveFrom: values.effectiveFrom,
      changeNote: values.changeNote ?? null,
      createdById: ctx.userId,
    });
    const result = await recalculateHealthScores(tx, ctx.organizationId, { accountIds, reason: `scorecard_v${version.version}` });
    await recordAudit(tx, ctx, {
      action: "scorecard.updated",
      entityType: "scorecard",
      entityId: scorecardId,
      summary: `${sc.name} saved as v${version.version} — ${result.scoresChanged} score${result.scoresChanged === 1 ? "" : "s"} changed, ${result.bandChanges.length} band change${result.bandChanges.length === 1 ? "" : "s"}`,
      before: { weights: sc.weights, thresholds: sc.thresholds, version: sc.version },
      after: { weights: values.weights, thresholds: values.thresholds, version: version.version, effectiveFrom: values.effectiveFrom },
    });
    // Tell owners when their accounts change band.
    const changed = rows.filter((r) => result.bandChanges.some((b) => b.accountId === r.id) && r.ownerId && r.ownerId !== ctx.userId);
    await notifyUsers(
      tx,
      changed.map((r) => ({
        organizationId: ctx.organizationId,
        userId: r.ownerId!,
        type: "health.band_changed",
        title: `${r.name} changed health band`,
        body: `${sc.name} weighting was updated by ${ctx.userName}.`,
        href: `/accounts/${r.id}`,
      })),
    );
    return { version: version.version, ...result };
  });
}

export async function recalculateAll(ctx: ServiceContext) {
  assertPermission(ctx, "scorecards.manage");
  return db.transaction(async (tx) => {
    const result = await recalculateHealthScores(tx, ctx.organizationId, { reason: "manual_recalculation" });
    await recordAudit(tx, ctx, { action: "health.recalculated", entityType: "workspace", summary: `Recalculated ${result.accountsProcessed} health scores — ${result.scoresChanged} changed` });
    return result;
  });
}
