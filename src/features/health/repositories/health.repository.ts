import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  DEFAULT_BAND_THRESHOLDS,
  HEALTH_SOURCE_KEYS,
  type BandThresholds,
  type HealthBandKey,
  type HealthSourceKey,
  type SourceWeights,
} from "@/config/health";
import type { DbExecutor } from "@/lib/db/client";
import {
  healthMetricValues,
  healthScores,
  healthScoreSnapshots,
  healthSourceScores,
  lifecycleStages,
  scorecards,
  scorecardVersions,
  scorecardWeights,
  segments,
  users,
} from "@/lib/db/schema";
import type { SourceScores } from "@/features/health/domain/score";

export interface ActiveScorecard {
  scorecardId: string;
  name: string;
  lifecycleStageId: string;
  lifecycle: string;
  segmentId: string;
  segment: string;
  versionId: string;
  version: number;
  thresholds: BandThresholds;
  weights: SourceWeights;
  effectiveFrom: string;
  formula: string;
  updatedAt: Date;
  updatedByName: string | null;
}

function emptyWeights(): SourceWeights {
  return Object.fromEntries(HEALTH_SOURCE_KEYS.map((k) => [k, 0])) as SourceWeights;
}

export function scorecardKey(lifecycleStageId: string, segmentId: string): string {
  return `${lifecycleStageId}|${segmentId}`;
}

export async function listActiveScorecards(executor: DbExecutor, organizationId: string): Promise<ActiveScorecard[]> {
  const rows = await executor
    .select({
      scorecardId: scorecards.id,
      name: scorecards.name,
      lifecycleStageId: scorecards.lifecycleStageId,
      lifecycle: lifecycleStages.name,
      lifecyclePosition: lifecycleStages.position,
      segmentId: scorecards.segmentId,
      segment: segments.name,
      segmentPosition: segments.position,
      versionId: scorecardVersions.id,
      version: scorecardVersions.version,
      thresholds: scorecardVersions.thresholds,
      effectiveFrom: scorecardVersions.effectiveFrom,
      formula: scorecardVersions.formula,
      updatedAt: scorecardVersions.createdAt,
      updatedByName: users.name,
    })
    .from(scorecards)
    .innerJoin(lifecycleStages, eq(scorecards.lifecycleStageId, lifecycleStages.id))
    .innerJoin(segments, eq(scorecards.segmentId, segments.id))
    .innerJoin(scorecardVersions, and(eq(scorecardVersions.scorecardId, scorecards.id), eq(scorecardVersions.isActive, true)))
    .leftJoin(users, eq(scorecardVersions.createdById, users.id))
    .where(eq(scorecards.organizationId, organizationId))
    .orderBy(asc(lifecycleStages.position), asc(segments.position));

  if (rows.length === 0) return [];
  const weightRows = await executor
    .select({ versionId: scorecardWeights.scorecardVersionId, sourceKey: scorecardWeights.sourceKey, weight: scorecardWeights.weight })
    .from(scorecardWeights)
    .where(inArray(scorecardWeights.scorecardVersionId, rows.map((r) => r.versionId)));

  const weightsByVersion = new Map<string, SourceWeights>();
  for (const w of weightRows) {
    const weights = weightsByVersion.get(w.versionId) ?? emptyWeights();
    weights[w.sourceKey] = w.weight;
    weightsByVersion.set(w.versionId, weights);
  }
  return rows.map(({ lifecyclePosition: _l, segmentPosition: _s, ...r }) => ({
    ...r,
    thresholds: r.thresholds ?? DEFAULT_BAND_THRESHOLDS,
    weights: weightsByVersion.get(r.versionId) ?? emptyWeights(),
  }));
}

export async function getScorecardVersionHistory(executor: DbExecutor, organizationId: string, scorecardId: string) {
  return executor
    .select({
      id: scorecardVersions.id,
      version: scorecardVersions.version,
      thresholds: scorecardVersions.thresholds,
      effectiveFrom: scorecardVersions.effectiveFrom,
      isActive: scorecardVersions.isActive,
      changeNote: scorecardVersions.changeNote,
      createdAt: scorecardVersions.createdAt,
      createdByName: users.name,
    })
    .from(scorecardVersions)
    .leftJoin(users, eq(scorecardVersions.createdById, users.id))
    .where(and(eq(scorecardVersions.organizationId, organizationId), eq(scorecardVersions.scorecardId, scorecardId)))
    .orderBy(desc(scorecardVersions.version));
}

export async function createScorecardVersion(
  executor: DbExecutor,
  input: {
    organizationId: string;
    scorecardId: string;
    thresholds: BandThresholds;
    weights: SourceWeights;
    effectiveFrom: string;
    changeNote: string | null;
    createdById: string | null;
  },
): Promise<{ id: string; version: number }> {
  const [latest] = await executor
    .select({ version: scorecardVersions.version })
    .from(scorecardVersions)
    .where(eq(scorecardVersions.scorecardId, input.scorecardId))
    .orderBy(desc(scorecardVersions.version))
    .limit(1);
  await executor
    .update(scorecardVersions)
    .set({ isActive: false })
    .where(and(eq(scorecardVersions.scorecardId, input.scorecardId), eq(scorecardVersions.isActive, true)));
  const [created] = await executor
    .insert(scorecardVersions)
    .values({
      organizationId: input.organizationId,
      scorecardId: input.scorecardId,
      version: (latest?.version ?? 0) + 1,
      thresholds: input.thresholds,
      effectiveFrom: input.effectiveFrom,
      changeNote: input.changeNote,
      createdById: input.createdById,
      isActive: true,
    })
    .returning({ id: scorecardVersions.id, version: scorecardVersions.version });
  await executor.insert(scorecardWeights).values(
    HEALTH_SOURCE_KEYS.map((sourceKey) => ({ scorecardVersionId: created.id, sourceKey, weight: input.weights[sourceKey] })),
  );
  return created;
}

/** Latest sub-score per source per account. */
export async function getCurrentSourceScores(
  executor: DbExecutor,
  organizationId: string,
  accountIds?: readonly string[],
): Promise<Map<string, SourceScores>> {
  if (accountIds && accountIds.length === 0) return new Map();
  const rows = await executor
    .selectDistinctOn([healthSourceScores.accountId, healthSourceScores.sourceKey], {
      accountId: healthSourceScores.accountId,
      sourceKey: healthSourceScores.sourceKey,
      score: healthSourceScores.score,
    })
    .from(healthSourceScores)
    .where(
      and(
        eq(healthSourceScores.organizationId, organizationId),
        accountIds ? inArray(healthSourceScores.accountId, [...accountIds]) : undefined,
      ),
    )
    .orderBy(healthSourceScores.accountId, healthSourceScores.sourceKey, desc(healthSourceScores.period));
  const result = new Map<string, SourceScores>();
  for (const r of rows) {
    const scores = result.get(r.accountId) ?? {};
    scores[r.sourceKey] = r.score;
    result.set(r.accountId, scores);
  }
  return result;
}

export interface HealthScoreUpsert {
  accountId: string;
  scorecardVersionId: string | null;
  score: number;
  band: HealthBandKey;
  predictiveRisk: number;
  trendDelta: number;
  weakestSource: HealthSourceKey | null;
}

export async function upsertHealthScores(executor: DbExecutor, organizationId: string, values: HealthScoreUpsert[], at: Date): Promise<void> {
  if (values.length === 0) return;
  await executor
    .insert(healthScores)
    .values(values.map((v) => ({ ...v, organizationId, calculatedAt: at })))
    .onConflictDoUpdate({
      target: healthScores.accountId,
      set: {
        scorecardVersionId: sql`excluded.scorecard_version_id`,
        score: sql`excluded.score`,
        band: sql`excluded.band`,
        predictiveRisk: sql`excluded.predictive_risk`,
        trendDelta: sql`excluded.trend_delta`,
        weakestSource: sql`excluded.weakest_source`,
        calculatedAt: sql`excluded.calculated_at`,
      },
    });
}

export async function insertSnapshots(
  executor: DbExecutor,
  organizationId: string,
  values: Array<{ accountId: string; scorecardVersionId: string | null; score: number; band: HealthBandKey; reason: string; takenAt: Date }>,
): Promise<void> {
  if (values.length === 0) return;
  await executor.insert(healthScoreSnapshots).values(values.map((v) => ({ ...v, organizationId })));
}

export async function getSnapshotHistory(
  executor: DbExecutor,
  organizationId: string,
  options: { accountIds?: readonly string[]; since?: Date } = {},
): Promise<Map<string, Array<{ score: number; band: HealthBandKey; takenAt: Date; reason: string }>>> {
  if (options.accountIds && options.accountIds.length === 0) return new Map();
  const rows = await executor
    .select({
      accountId: healthScoreSnapshots.accountId,
      score: healthScoreSnapshots.score,
      band: healthScoreSnapshots.band,
      takenAt: healthScoreSnapshots.takenAt,
      reason: healthScoreSnapshots.reason,
    })
    .from(healthScoreSnapshots)
    .where(
      and(
        eq(healthScoreSnapshots.organizationId, organizationId),
        options.accountIds ? inArray(healthScoreSnapshots.accountId, [...options.accountIds]) : undefined,
        options.since ? gte(healthScoreSnapshots.takenAt, options.since) : undefined,
      ),
    )
    .orderBy(asc(healthScoreSnapshots.takenAt));
  const map = new Map<string, Array<{ score: number; band: HealthBandKey; takenAt: Date; reason: string }>>();
  for (const { accountId, ...snap } of rows) {
    const list = map.get(accountId) ?? [];
    list.push(snap);
    map.set(accountId, list);
  }
  return map;
}

export interface SourceHistoryRow {
  accountId: string;
  sourceKey: HealthSourceKey;
  period: string;
  score: number;
}

export async function getSourceHistory(executor: DbExecutor, organizationId: string, since: string, accountIds?: readonly string[]): Promise<SourceHistoryRow[]> {
  if (accountIds && accountIds.length === 0) return [];
  return executor
    .select({
      accountId: healthSourceScores.accountId,
      sourceKey: healthSourceScores.sourceKey,
      period: healthSourceScores.period,
      score: healthSourceScores.score,
    })
    .from(healthSourceScores)
    .where(
      and(
        eq(healthSourceScores.organizationId, organizationId),
        gte(healthSourceScores.period, since),
        accountIds ? inArray(healthSourceScores.accountId, [...accountIds]) : undefined,
      ),
    )
    .orderBy(asc(healthSourceScores.period));
}

export interface MetricHistoryRow {
  accountId: string;
  sourceKey: HealthSourceKey;
  metricKey: string;
  period: string;
  rawValue: number;
  score: number;
}

export async function getMetricHistory(
  executor: DbExecutor,
  organizationId: string,
  since: string,
  options: { accountIds?: readonly string[]; sourceKeys?: readonly HealthSourceKey[] } = {},
): Promise<MetricHistoryRow[]> {
  if (options.accountIds && options.accountIds.length === 0) return [];
  return executor
    .select({
      accountId: healthMetricValues.accountId,
      sourceKey: healthMetricValues.sourceKey,
      metricKey: healthMetricValues.metricKey,
      period: healthMetricValues.period,
      rawValue: healthMetricValues.rawValue,
      score: healthMetricValues.score,
    })
    .from(healthMetricValues)
    .where(
      and(
        eq(healthMetricValues.organizationId, organizationId),
        gte(healthMetricValues.period, since),
        options.accountIds ? inArray(healthMetricValues.accountId, [...options.accountIds]) : undefined,
        options.sourceKeys ? inArray(healthMetricValues.sourceKey, [...options.sourceKeys]) : undefined,
      ),
    )
    .orderBy(asc(healthMetricValues.period));
}
