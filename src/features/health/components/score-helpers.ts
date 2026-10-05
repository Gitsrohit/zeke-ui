import { getHealthSource, HEALTH_BANDS, type HealthSourceKey } from "@/config/health";
import type { ScoreAccount, ScoreFilters, ScorePortfolio } from "@/features/health/services/score-dashboard.service";
import { formatCurrency } from "@/lib/utils/format";

export type RawParams = Record<string, string | string[] | undefined>;

/** Flattens Next search params into a plain string record. */
export function flatParams(params: RawParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) out[k] = value;
  }
  return out;
}

/** Builds a /score-dashboard href from the current params plus overrides (null/"" removes a key). */
export function scoreHref(current: Record<string, string>, overrides: Record<string, string | null | undefined> = {}): string {
  const next = new URLSearchParams();
  const merged: Record<string, string | null | undefined> = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
  const qs = next.toString();
  return qs ? `/score-dashboard?${qs}` : "/score-dashboard";
}

export interface MetricFormat {
  unit: string;
  decimals: number;
  money: boolean;
}

export function formatMetric(m: MetricFormat, value: number): string {
  if (m.money) return formatCurrency(value);
  const n = m.decimals ? value.toFixed(m.decimals) : Math.round(value).toLocaleString("en-US");
  return `${n}${m.unit}`;
}

/** Axis-friendly variant without the unit suffix. */
export function formatMetricAxis(m: MetricFormat, value: number): string {
  if (m.money) return formatCurrency(value);
  return m.decimals ? value.toFixed(m.decimals) : Math.round(value).toLocaleString("en-US");
}

export function impactLabel(pointsLost: number): "High" | "Medium" | "Low" {
  if (pointsLost >= 6) return "High";
  if (pointsLost >= 3) return "Medium";
  return "Low";
}

export function threeMonthDelta(series: readonly number[]): number {
  if (series.length < 2) return 0;
  return series[series.length - 1] - series[Math.max(0, series.length - 4)];
}

/** Sentences explaining the portfolio, computed only from the data in view. */
export function portfolioInsights(p: ScorePortfolio): string[] {
  if (p.items.length === 0) return [];
  const byLost = [...p.sources].sort((a, b) => b.pointsLost - a.pointsLost);
  const out: string[] = [];
  const [first, second] = byLost;
  out.push(`${first.name} is costing the most — ${first.pointsLost.toFixed(1)} points off the average score — and is the weakest source for ${first.weakestFor} account${first.weakestFor === 1 ? "" : "s"}.`);
  if (second) out.push(`${second.name} is next at ${second.pointsLost.toFixed(1)} points.`);
  let worst: { source: string; name: string; change: number; declining: number } | null = null;
  for (const [key, metrics] of Object.entries(p.metrics)) {
    for (const m of metrics ?? []) {
      if (!worst || m.scoreChange < worst.change) worst = { source: getHealthSource(key as HealthSourceKey).name, name: m.name, change: m.scoreChange, declining: m.declining };
    }
  }
  if (worst && worst.change < -1) {
    out.push(`The fastest-slipping sub-measure shown is ${worst.name} (${worst.source}), down ${Math.abs(worst.change).toFixed(1)} points on average in 3 months and falling in ${worst.declining} account${worst.declining === 1 ? "" : "s"}.`);
  }
  if (p.riskCount) out.push(`${p.riskCount} account${p.riskCount === 1 ? " is" : "s are"} At Risk or Critical, with ${formatCurrency(p.riskArr)} ARR.`);
  return out;
}

/** Answers "why is this customer's score N?" from the account's own data. */
export function accountInsights(a: ScoreAccount): { headline: string; sentences: string[] } {
  const byLost = [...a.sources].sort((x, y) => y.pointsLost - x.pointsLost);
  const drag = byLost[0];
  const strongest = [...a.sources].sort((x, y) => y.score - x.score)[0];
  let worst: { metric: string; source: string; change: number; value: string } | null = null;
  for (const s of a.sources) {
    for (const m of s.metrics) {
      const change = threeMonthDelta(m.scores);
      if (!worst || change < worst.change) worst = { metric: m.name, source: s.name, change, value: formatMetric(m, m.raw[m.raw.length - 1] ?? 0) };
    }
  }
  const sentences = [
    `The biggest drag is ${drag.name} (${drag.score}), costing ${drag.pointsLost.toFixed(1)} points at its ${drag.weight}% weight.`,
    worst && worst.change < -2
      ? `The sharpest recent decline is ${worst.metric} in ${worst.source}, now ${worst.value} (down ${Math.abs(Math.round(worst.change))} score points in 3 months).`
      : "No sub-measure has dropped meaningfully in the last 3 months.",
    `Strongest source: ${strongest.name} (${strongest.score}).`,
  ];
  return { headline: `Why is ${a.account.name}'s health score ${a.account.score} (${HEALTH_BANDS[a.account.band].label})?`, sentences };
}

export const FILTER_LABELS: Record<keyof Omit<ScoreFilters, "sort">, string> = {
  q: "Search",
  stage: "Stage",
  segment: "Segment",
  csm: "CSM",
  band: "Health",
  trend: "Trend",
  arr: "ARR",
  renew: "Renewal",
  weak: "Weakest source",
  subSrc: "Sub-score",
  subOp: "Sub-score",
};
