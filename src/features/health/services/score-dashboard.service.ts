import { z } from "zod";
import {
  DEFAULT_BAND_THRESHOLDS,
  HEALTH_BAND_KEYS,
  HEALTH_BAND_ORDER,
  HEALTH_HISTORY_MONTHS,
  HEALTH_SOURCE_KEYS,
  HEALTH_SOURCES,
  SUB_METRICS,
  type BandThresholds,
  type HealthBandKey,
  type HealthSourceKey,
  type SourceWeights,
} from "@/config/health";
import { toAccountFacts } from "@/features/accounts/domain/facts";
import { listAccountRows, type AccountRow } from "@/features/accounts/repositories/account.repository";
import type { AccountFacts } from "@/features/audiences/domain/types";
import { calculateContributions, findLowestSourceScore, getHealthBand, type SourceScores } from "@/features/health/domain/score";
import {
  getCurrentSourceScores,
  getMetricHistory,
  getSnapshotHistory,
  getSourceHistory,
  listActiveScorecards,
  scorecardKey,
} from "@/features/health/repositories/health.repository";
import { db } from "@/lib/db/client";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { monthLabel, monthStart } from "@/lib/utils/dates";

export const scoreFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  stage: z.string().max(40).default(""),
  segment: z.string().max(40).default(""),
  csm: z.string().max(64).default(""),
  band: z.union([z.enum(HEALTH_BAND_KEYS), z.literal("")]).default(""),
  trend: z.enum(["", "up", "down", "flat"]).default(""),
  arr: z.enum(["", "lt50", "50-150", "gt150"]).default(""),
  renew: z.enum(["", "90", "180"]).default(""),
  weak: z.union([z.enum(HEALTH_SOURCE_KEYS), z.literal("")]).default(""),
  subSrc: z.union([z.enum(HEALTH_SOURCE_KEYS), z.literal("")]).default(""),
  subOp: z.enum(["", "lt40", "lt60", "gte80"]).default(""),
  sort: z.union([z.enum(["score", "name", "arr", "renewal"]), z.enum(HEALTH_SOURCE_KEYS)]).default("score"),
});
export type ScoreFilters = z.infer<typeof scoreFiltersSchema>;

export function parseScoreFilters(params: Record<string, string | string[] | undefined>): ScoreFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined));
  const parsed = scoreFiltersSchema.safeParse(flat);
  return parsed.success ? parsed.data : scoreFiltersSchema.parse({});
}

interface Row {
  row: AccountRow;
  facts: AccountFacts;
  sources: SourceScores;
  weights: Partial<SourceWeights>;
  thresholds: BandThresholds;
}

function applyFilters(rows: Row[], f: ScoreFilters): Row[] {
  const q = f.q.toLowerCase();
  return rows
    .filter(({ row, facts, sources }) => {
      if (f.stage && facts.lifecycle !== f.stage) return false;
      if (f.segment && facts.segment !== f.segment) return false;
      if (f.csm && facts.ownerId !== f.csm) return false;
      if (f.band && facts.band !== f.band) return false;
      const t = row.trendDelta ?? 0;
      if (f.trend === "up" && t <= 1) return false;
      if (f.trend === "down" && t >= -1) return false;
      if (f.trend === "flat" && Math.abs(t) > 1) return false;
      if (f.arr === "lt50" && facts.arr >= 50_000) return false;
      if (f.arr === "50-150" && (facts.arr < 50_000 || facts.arr > 150_000)) return false;
      if (f.arr === "gt150" && facts.arr <= 150_000) return false;
      if (f.renew && (facts.renewalInDays === null || facts.renewalInDays > Number(f.renew))) return false;
      if (f.weak && findLowestSourceScore(sources) !== f.weak) return false;
      if (f.subSrc && f.subOp) {
        const v = sources[f.subSrc] ?? 0;
        if (f.subOp === "lt40" && v >= 40) return false;
        if (f.subOp === "lt60" && v >= 60) return false;
        if (f.subOp === "gte80" && v < 80) return false;
      }
      if (q) {
        const hay = [facts.name, facts.ownerName, facts.lifecycle, facts.segment].join(" ").toLowerCase();
        if (!q.split(/\s+/).every((term) => hay.includes(term))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (f.sort === "name") return a.facts.name.localeCompare(b.facts.name);
      if (f.sort === "arr") return b.facts.arr - a.facts.arr;
      if (f.sort === "renewal") return (a.facts.renewalInDays ?? 9999) - (b.facts.renewalInDays ?? 9999);
      if (f.sort !== "score") return (a.sources[f.sort] ?? 0) - (b.sources[f.sort] ?? 0);
      return a.facts.healthScore - b.facts.healthScore;
    });
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  const i = (a.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}

async function loadRows(ctx: ServiceContext): Promise<{ rows: Row[]; periods: string[] }> {
  const accountRows = await listAccountRows(db, ctx, { activeOnly: true });
  const [sources, scorecards] = await Promise.all([getCurrentSourceScores(db, ctx.organizationId, accountRows.map((r) => r.id)), listActiveScorecards(db, ctx.organizationId)]);
  const byKey = new Map(scorecards.map((s) => [scorecardKey(s.lifecycleStageId, s.segmentId), s]));
  const now = new Date();
  const periods = Array.from({ length: HEALTH_HISTORY_MONTHS }, (_, k) => monthStart(now, k - (HEALTH_HISTORY_MONTHS - 1)));
  return {
    periods,
    rows: accountRows.map((row) => {
      const sc = byKey.get(scorecardKey(row.lifecycleStageId, row.segmentId));
      return { row, facts: toAccountFacts(row, now), sources: sources.get(row.id) ?? {}, weights: sc?.weights ?? {}, thresholds: sc?.thresholds ?? DEFAULT_BAND_THRESHOLDS };
    }),
  };
}

/** Monthly overall score per account: last snapshot in each month, current score for this month. */
async function overallHistories(ctx: ServiceContext, rows: Row[], periods: string[]): Promise<Map<string, number[]>> {
  const snaps = await getSnapshotHistory(db, ctx.organizationId, { accountIds: rows.map((r) => r.row.id), since: new Date(`${periods[0]}T00:00:00Z`) });
  const result = new Map<string, number[]>();
  for (const r of rows) {
    const list = snaps.get(r.row.id) ?? [];
    let carry = list[0]?.score ?? r.facts.healthScore;
    const series = periods.map((period, k) => {
      if (k === periods.length - 1) return r.facts.healthScore;
      const next = periods[k + 1];
      const inMonth = list.filter((s) => s.takenAt.toISOString().slice(0, 10) >= period && s.takenAt.toISOString().slice(0, 10) < next);
      if (inMonth.length) carry = inMonth[inMonth.length - 1].score;
      return carry;
    });
    result.set(r.row.id, series);
  }
  return result;
}

function sourceHistoryMap(history: Awaited<ReturnType<typeof getSourceHistory>>, periods: string[]) {
  const map = new Map<string, Record<HealthSourceKey, number[]>>();
  for (const h of history) {
    const idx = periods.indexOf(h.period);
    if (idx < 0) continue;
    let rec = map.get(h.accountId);
    if (!rec) {
      rec = Object.fromEntries(HEALTH_SOURCE_KEYS.map((k) => [k, new Array<number>(periods.length).fill(Number.NaN)])) as Record<HealthSourceKey, number[]>;
      map.set(h.accountId, rec);
    }
    rec[h.sourceKey][idx] = h.score;
  }
  // Forward/back-fill gaps so sparse accounts still chart.
  for (const rec of map.values()) {
    for (const k of HEALTH_SOURCE_KEYS) {
      const s = rec[k];
      const first = s.find((v) => !Number.isNaN(v)) ?? 0;
      let last = first;
      for (let i = 0; i < s.length; i++) {
        if (Number.isNaN(s[i])) s[i] = last;
        else last = s[i];
      }
    }
  }
  return map;
}

export interface ScoreListItem {
  id: string;
  name: string;
  lifecycle: string;
  segment: string;
  ownerName: string | null;
  arr: number;
  score: number;
  band: HealthBandKey;
  renewalInDays: number | null;
  sources: SourceScores;
  sourceBands: Partial<Record<HealthSourceKey, HealthBandKey>>;
  history: number[];
}

function toListItem(r: Row, history: number[]): ScoreListItem {
  const sourceBands = Object.fromEntries(HEALTH_SOURCE_KEYS.map((k) => [k, getHealthBand(r.sources[k] ?? 0)])) as Partial<Record<HealthSourceKey, HealthBandKey>>;
  return {
    id: r.facts.id,
    name: r.facts.name,
    lifecycle: r.facts.lifecycle,
    segment: r.facts.segment,
    ownerName: r.facts.ownerName,
    arr: r.facts.arr,
    score: r.facts.healthScore,
    band: r.facts.band,
    renewalInDays: r.facts.renewalInDays,
    sources: r.sources,
    sourceBands,
    history,
  };
}

function metricAggregates(source: HealthSourceKey, metricRows: Awaited<ReturnType<typeof getMetricHistory>>, periods: string[], accounts: Row[]) {
  const names = new Map(accounts.map((a) => [a.row.id, a.facts.name]));
  return SUB_METRICS[source].map((def) => {
    const rows = metricRows.filter((m) => m.sourceKey === source && m.metricKey === def.key);
    const byPeriod = periods.map((p) => rows.filter((r) => r.period === p));
    const latest = byPeriod[byPeriod.length - 1];
    const threeAgo = byPeriod[Math.max(0, byPeriod.length - 4)];
    const change = new Map<string, number>();
    for (const l of latest) {
      const prev = threeAgo.find((t) => t.accountId === l.accountId);
      if (prev) change.set(l.accountId, l.score - prev.score);
    }
    return {
      key: def.key,
      name: def.name,
      unit: def.unit ?? "",
      decimals: def.decimals,
      money: def.money ?? false,
      hint: def.hint ?? null,
      weight: def.weight,
      higherIsBetter: def.best > def.worst,
      raw: byPeriod.map((list) => avg(list.map((r) => r.rawValue))),
      p25: byPeriod.map((list) => percentile(list.map((r) => r.rawValue), 0.25)),
      p75: byPeriod.map((list) => percentile(list.map((r) => r.rawValue), 0.75)),
      score: avg(latest.map((r) => r.score)),
      scoreChange: avg([...change.values()]),
      below40: latest.filter((r) => r.score < 40).length,
      declining: [...change.values()].filter((c) => c < -5).length,
      weakest: [...latest]
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map((r) => ({ accountId: r.accountId, name: names.get(r.accountId) ?? "", raw: r.rawValue, score: r.score })),
    };
  });
}

export type MetricAggregate = ReturnType<typeof metricAggregates>[number];

export async function getScorePortfolio(ctx: ServiceContext, filters: ScoreFilters, focusSource?: HealthSourceKey | "all") {
  assertPermission(ctx, "accounts.read");
  const { rows: all, periods } = await loadRows(ctx);
  const rows = applyFilters(all, filters);
  const ids = rows.map((r) => r.row.id);
  const [histories, sourceHistory] = await Promise.all([overallHistories(ctx, rows, periods), getSourceHistory(db, ctx.organizationId, periods[0], ids)]);
  const srcMap = sourceHistoryMap(sourceHistory, periods);
  const months = periods.map(monthLabel);
  const items = rows.map((r) => toListItem(r, histories.get(r.row.id) ?? []));

  const overall = periods.map((_, k) => avg(items.map((i) => i.history[k] ?? i.score)));
  const bandMix = periods.map((_, k) => {
    const mix = Object.fromEntries(HEALTH_BAND_ORDER.map((b) => [b, 0])) as Record<HealthBandKey, number>;
    rows.forEach((r) => mix[getHealthBand(histories.get(r.row.id)?.[k] ?? r.facts.healthScore, r.thresholds)]++);
    return mix;
  });

  const sources = HEALTH_SOURCES.map((s) => {
    const contribs = rows.map((r) => calculateContributions(r.sources, r.weights).find((c) => c.source === s.key)!);
    const histories = rows.map((r) => srcMap.get(r.row.id)?.[s.key] ?? new Array(periods.length).fill(r.sources[s.key] ?? 0));
    return {
      key: s.key,
      name: s.name,
      shortName: s.shortName,
      description: s.description,
      now: avg(rows.map((r) => r.sources[s.key] ?? 0)),
      history: periods.map((_, k) => avg(histories.map((h) => h[k]))),
      p25: periods.map((_, k) => percentile(histories.map((h) => h[k]), 0.25)),
      p75: periods.map((_, k) => percentile(histories.map((h) => h[k]), 0.75)),
      pointsGained: avg(contribs.map((c) => c?.points ?? 0)),
      pointsLost: avg(contribs.map((c) => c?.pointsLost ?? 0)),
      weakestFor: rows.filter((r) => findLowestSourceScore(r.sources) === s.key).length,
      below40: rows.filter((r) => (r.sources[s.key] ?? 0) < 40).length,
    };
  });
  const byLost = [...sources].sort((a, b) => b.pointsLost - a.pointsLost);
  const focus: HealthSourceKey[] = focusSource === "all" ? [...HEALTH_SOURCE_KEYS] : [focusSource ?? byLost[0]?.key ?? "telemetry"];
  const metricRows = rows.length ? await getMetricHistory(db, ctx.organizationId, periods[0], { accountIds: ids, sourceKeys: focus }) : [];

  return {
    months,
    totalAccounts: all.length,
    items,
    overall,
    overallP25: periods.map((_, k) => percentile(items.map((i) => i.history[k] ?? i.score), 0.25)),
    overallP75: periods.map((_, k) => percentile(items.map((i) => i.history[k] ?? i.score), 0.75)),
    bandMix,
    sources,
    focus,
    metrics: Object.fromEntries(focus.map((k) => [k, metricAggregates(k, metricRows, periods, rows)])) as Partial<Record<HealthSourceKey, MetricAggregate[]>>,
    totalArr: rows.reduce((s, r) => s + r.facts.arr, 0),
    riskCount: rows.filter((r) => r.facts.band === "atRisk" || r.facts.band === "critical").length,
    riskArr: rows.filter((r) => r.facts.band === "atRisk" || r.facts.band === "critical").reduce((s, r) => s + r.facts.arr, 0),
    decliningFast: items.filter((i) => (i.history[i.history.length - 1] ?? 0) - (i.history[i.history.length - 4] ?? 0) < -5).length,
  };
}

export type ScorePortfolio = Awaited<ReturnType<typeof getScorePortfolio>>;

export async function getScoreAccount(ctx: ServiceContext, filters: ScoreFilters, accountId: string) {
  assertPermission(ctx, "accounts.read");
  const { rows: all, periods } = await loadRows(ctx);
  const list = applyFilters(all, filters);
  const target = all.find((r) => r.row.id === accountId);
  if (!target) return null;
  const [histories, sourceHistory, metricRows] = await Promise.all([
    overallHistories(ctx, [target], periods),
    getSourceHistory(db, ctx.organizationId, periods[0], [accountId]),
    getMetricHistory(db, ctx.organizationId, periods[0], { accountIds: [accountId] }),
  ]);
  const srcMap = sourceHistoryMap(sourceHistory, periods).get(accountId);
  const peers = all.filter((r) => r.facts.lifecycle === target.facts.lifecycle && r.facts.segment === target.facts.segment);
  const contributions = calculateContributions(target.sources, target.weights);

  const sources = HEALTH_SOURCES.map((s) => {
    const history = srcMap?.[s.key] ?? new Array(periods.length).fill(target.sources[s.key] ?? 0);
    const contribution = contributions.find((c) => c.source === s.key)!;
    return {
      key: s.key,
      name: s.name,
      description: s.description,
      score: target.sources[s.key] ?? 0,
      weight: target.weights[s.key] ?? 0,
      points: contribution.points,
      pointsLost: contribution.pointsLost,
      normalizedWeight: contribution.normalizedWeight,
      history,
      change3m: history[history.length - 1] - history[Math.max(0, history.length - 4)],
      peerAverage: avg(peers.map((p) => p.sources[s.key] ?? 0)),
      metrics: SUB_METRICS[s.key].map((def) => {
        const series = periods.map((p) => metricRows.find((m) => m.sourceKey === s.key && m.metricKey === def.key && m.period === p));
        return {
          key: def.key,
          name: def.name,
          unit: def.unit ?? "",
          decimals: def.decimals,
          money: def.money ?? false,
          hint: def.hint ?? null,
          weight: def.weight,
          higherIsBetter: def.best > def.worst,
          raw: series.map((m) => m?.rawValue ?? 0),
          scores: series.map((m) => m?.score ?? 0),
        };
      }),
    };
  });
  const idx = list.findIndex((r) => r.row.id === accountId);
  return {
    months: periods.map(monthLabel),
    account: { ...toListItem(target, histories.get(accountId) ?? []), predictiveRisk: target.facts.predictiveRisk, trendDelta: target.row.trendDelta ?? 0, thresholds: target.thresholds },
    sources,
    neighbours: { previous: idx > 0 ? list[idx - 1].row.id : null, next: idx >= 0 && idx < list.length - 1 ? list[idx + 1].row.id : null },
    list: list.map((r) => ({ id: r.row.id, name: r.facts.name, lifecycle: r.facts.lifecycle, segment: r.facts.segment, ownerName: r.facts.ownerName, score: r.facts.healthScore, band: r.facts.band })),
    totalAccounts: all.length,
  };
}

export type ScoreAccount = NonNullable<Awaited<ReturnType<typeof getScoreAccount>>>;

export async function exportScoreCsv(ctx: ServiceContext, filters: ScoreFilters): Promise<string> {
  assertPermission(ctx, "accounts.read");
  const { rows: all } = await loadRows(ctx);
  const rows = applyFilters(all, filters);
  const head = ["Account", "Stage", "Segment", "CSM", "ARR", "Health", "Band", "Trend (pts)", "Renewal (days)", ...HEALTH_SOURCES.map((s) => s.name)];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    // Neutralise spreadsheet formula injection and quote special characters.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = rows.map((r) => [r.facts.name, r.facts.lifecycle, r.facts.segment, r.facts.ownerName, r.facts.arr, r.facts.healthScore, r.facts.band, r.row.trendDelta ?? 0, r.facts.renewalInDays, ...HEALTH_SOURCE_KEYS.map((k) => r.sources[k] ?? "")]);
  return [head, ...lines].map((l) => l.map(esc).join(",")).join("\n");
}
