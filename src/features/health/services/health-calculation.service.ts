import { DEFAULT_BAND_THRESHOLDS, type SourceWeights } from "@/config/health";
import { listAccountRows } from "@/features/accounts/repositories/account.repository";
import {
  calculateHealthScore,
  calculatePredictiveRisk,
  findWeakestHealthSignal,
  getHealthBand,
} from "@/features/health/domain/score";
import {
  getCurrentSourceScores,
  getSnapshotHistory,
  insertSnapshots,
  listActiveScorecards,
  scorecardKey,
  upsertHealthScores,
  type HealthScoreUpsert,
} from "@/features/health/repositories/health.repository";
import type { DbExecutor } from "@/lib/db/client";
import { daysSince, DAY_MS } from "@/lib/utils/dates";

export interface RecalculationResult {
  accountsProcessed: number;
  scoresChanged: number;
  bandChanges: Array<{ accountId: string; from: string | null; to: string }>;
}

const TREND_LOOKBACK_DAYS = 90;

/**
 * Recomputes health score, band, predictive risk, trend and weakest signal for an
 * organisation's accounts from their current source sub-scores and the active
 * scorecard version for each account's lifecycle × segment. Writes a snapshot
 * whenever the score changes.
 */
export async function recalculateHealthScores(
  executor: DbExecutor,
  organizationId: string,
  options: { accountIds?: readonly string[]; reason?: string; now?: Date } = {},
): Promise<RecalculationResult> {
  const now = options.now ?? new Date();
  const reason = options.reason ?? "recalculation";
  const rows = await listAccountRows(executor, { organizationId, segmentScope: [] }, { ids: options.accountIds });
  if (rows.length === 0) return { accountsProcessed: 0, scoresChanged: 0, bandChanges: [] };

  const ids = rows.map((r) => r.id);
  const [scorecards, sourcesByAccount, snapshots] = await Promise.all([
    listActiveScorecards(executor, organizationId),
    getCurrentSourceScores(executor, organizationId, ids),
    getSnapshotHistory(executor, organizationId, { accountIds: ids, since: new Date(now.getTime() - 400 * DAY_MS) }),
  ]);
  const scorecardByKey = new Map(scorecards.map((s) => [scorecardKey(s.lifecycleStageId, s.segmentId), s]));

  const upserts: HealthScoreUpsert[] = [];
  const newSnapshots: Parameters<typeof insertSnapshots>[2] = [];
  const bandChanges: RecalculationResult["bandChanges"] = [];

  for (const row of rows) {
    const scorecard = scorecardByKey.get(scorecardKey(row.lifecycleStageId, row.segmentId));
    const weights: Partial<SourceWeights> = scorecard?.weights ?? {};
    const thresholds = scorecard?.thresholds ?? DEFAULT_BAND_THRESHOLDS;
    const sources = sourcesByAccount.get(row.id) ?? {};

    const score = calculateHealthScore(sources, weights);
    const band = getHealthBand(score, thresholds);
    const history = snapshots.get(row.id) ?? [];
    const cutoff = now.getTime() - TREND_LOOKBACK_DAYS * DAY_MS;
    const baseline = [...history].reverse().find((s) => s.takenAt.getTime() <= cutoff) ?? history[0];
    const trendDelta = baseline ? score - baseline.score : 0;
    const predictiveRisk = calculatePredictiveRisk({
      trendDelta,
      openTickets: row.openTickets,
      lastMeetingDays: daysSince(row.lastMeetingAt, now),
      lastLoginDays: daysSince(row.lastLoginAt, now),
      nps: row.nps,
      telemetryScore: sources.telemetry ?? 0,
    });
    const weakest = Object.keys(sources).length ? findWeakestHealthSignal(sources, weights).source : null;

    upserts.push({ accountId: row.id, scorecardVersionId: scorecard?.versionId ?? null, score, band, predictiveRisk, trendDelta, weakestSource: weakest });
    if (row.score !== score) {
      newSnapshots.push({ accountId: row.id, scorecardVersionId: scorecard?.versionId ?? null, score, band, reason, takenAt: now });
    }
    if (row.band !== band) bandChanges.push({ accountId: row.id, from: row.band, to: band });
  }

  await upsertHealthScores(executor, organizationId, upserts, now);
  await insertSnapshots(executor, organizationId, newSnapshots);
  return { accountsProcessed: rows.length, scoresChanged: newSnapshots.length, bandChanges };
}
