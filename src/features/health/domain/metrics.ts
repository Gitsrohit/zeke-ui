import { SEGMENT_SCALE, type SegmentName, type SubMetricDefinition } from "@/config/health";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function isSegment(value: string): value is SegmentName {
  return value in SEGMENT_SCALE;
}

/** Raw [worst, best] range for a sub-metric, scaled for segment where applicable. */
export function metricRange(def: SubMetricDefinition, segment: string): [number, number] {
  const scale = def.segmentScaled && isSegment(segment) ? SEGMENT_SCALE[segment] : 1;
  return [def.worst * scale, def.best * scale];
}

/** Normalised 0–100 score → raw measure value. */
export function metricRawFromScore(def: SubMetricDefinition, segment: string, score: number): number {
  const [worst, best] = metricRange(def, segment);
  return worst + ((best - worst) * score) / 100;
}

/** Raw measure value → normalised score (clamped to 2–100). */
export function metricScoreFromRaw(def: SubMetricDefinition, segment: string, raw: number): number {
  const [worst, best] = metricRange(def, segment);
  if (best === worst) return 100;
  return clamp(((raw - worst) / (best - worst)) * 100, 2, 100);
}

export function isHigherBetter(def: SubMetricDefinition): boolean {
  return def.best > def.worst;
}

export function formatMetricValue(def: SubMetricDefinition, value: number): string {
  if (def.money) return value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${Math.round(value)}`;
  const n = def.decimals ? value.toFixed(def.decimals) : Math.round(value).toLocaleString("en-US");
  return n + (def.unit ?? "");
}

/** Weighted average of sub-metric scores — equals the source sub-score. */
export function sourceScoreFromMetrics(defs: readonly SubMetricDefinition[], scores: readonly number[]): number {
  const wsum = defs.reduce((sum, d) => sum + d.weight, 0) || 1;
  return defs.reduce((sum, d, i) => sum + (scores[i] ?? 0) * d.weight, 0) / wsum;
}
