import {
  DEFAULT_BAND_THRESHOLDS,
  HEALTH_SOURCE_KEYS,
  type BandThresholds,
  type HealthBandKey,
  type HealthSourceKey,
  type SourceWeights,
} from "@/config/health";

export type SourceScores = Partial<Record<HealthSourceKey, number>>;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function totalWeight(weights: Partial<SourceWeights>): number {
  return HEALTH_SOURCE_KEYS.reduce((sum, key) => sum + (weights[key] ?? 0), 0);
}

/**
 * Weighted average of source sub-scores. Weights are normalised by their sum so a
 * scorecard that does not total exactly 100 still yields a 0–100 score.
 */
export function calculateHealthScore(sources: SourceScores, weights: Partial<SourceWeights>): number {
  const wsum = totalWeight(weights);
  if (wsum === 0) return 0;
  const total = HEALTH_SOURCE_KEYS.reduce((sum, key) => sum + (sources[key] ?? 0) * (weights[key] ?? 0), 0);
  return Math.round(total / wsum);
}

export function getHealthBand(score: number, thresholds: BandThresholds = DEFAULT_BAND_THRESHOLDS): HealthBandKey {
  if (score >= thresholds.thriving) return "thriving";
  if (score >= thresholds.stable) return "stable";
  if (score >= thresholds.atRisk) return "atRisk";
  return "critical";
}

export function isAtRiskBand(band: HealthBandKey): boolean {
  return band === "atRisk" || band === "critical";
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface WeightValidationResult extends ValidationResult {
  total: number;
}

export function validateWeights(weights: Partial<SourceWeights>): WeightValidationResult {
  const errors: string[] = [];
  for (const key of HEALTH_SOURCE_KEYS) {
    const w = weights[key];
    if (w === undefined) errors.push(`Missing weight for ${key}`);
    else if (!Number.isInteger(w)) errors.push(`Weight for ${key} must be a whole number`);
    else if (w < 0 || w > 100) errors.push(`Weight for ${key} must be between 0 and 100`);
  }
  const total = totalWeight(weights);
  if (total !== 100) errors.push(`Weights must total 100% (currently ${total}%)`);
  return { valid: errors.length === 0, total, errors };
}

export function validateBandThresholds(t: BandThresholds): ValidationResult {
  const errors: string[] = [];
  const values = [t.thriving, t.stable, t.atRisk];
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 99)) {
    errors.push("Band minimums must be whole numbers between 1 and 99.");
  }
  if (!(t.thriving > t.stable && t.stable > t.atRisk)) {
    errors.push("Each band minimum must be lower than the one above it.");
  }
  return { valid: errors.length === 0, errors };
}

export interface SourceContribution {
  source: HealthSourceKey;
  score: number;
  weight: number;
  /** Weight as a share of the scorecard total (0–100). */
  normalizedWeight: number;
  /** Points this source adds to the overall score. */
  points: number;
  /** Points this source costs the overall score versus a perfect 100. */
  pointsLost: number;
}

export function calculateContributions(sources: SourceScores, weights: Partial<SourceWeights>): SourceContribution[] {
  const wsum = totalWeight(weights) || 1;
  return HEALTH_SOURCE_KEYS.map((source) => {
    const score = sources[source] ?? 0;
    const weight = weights[source] ?? 0;
    return {
      source,
      score,
      weight,
      normalizedWeight: (weight * 100) / wsum,
      points: (score * weight) / wsum,
      pointsLost: ((100 - score) * weight) / wsum,
    };
  });
}

/**
 * The weakest weighted contributor — the source losing the most points
 * after weighting, i.e. what is dragging the score down the most.
 */
export function findWeakestHealthSignal(sources: SourceScores, weights: Partial<SourceWeights>): SourceContribution {
  const contributions = calculateContributions(sources, weights);
  return contributions.reduce((worst, c) => (c.pointsLost > worst.pointsLost ? c : worst), contributions[0]);
}

/** The lowest raw sub-score, regardless of weight. */
export function findLowestSourceScore(sources: SourceScores): HealthSourceKey {
  return HEALTH_SOURCE_KEYS.reduce((low, key) => ((sources[key] ?? 0) < (sources[low] ?? 0) ? key : low), HEALTH_SOURCE_KEYS[0]);
}

export function findStrongestSource(sources: SourceScores): HealthSourceKey {
  return HEALTH_SOURCE_KEYS.reduce((high, key) => ((sources[key] ?? 0) > (sources[high] ?? 0) ? key : high), HEALTH_SOURCE_KEYS[0]);
}

export interface PredictiveRiskInput {
  trendDelta: number;
  openTickets: number;
  lastMeetingDays: number | null;
  lastLoginDays: number | null;
  nps: number | null;
  telemetryScore: number;
}

/**
 * Predictive risk (0 = high risk of churn, 100 = safe). Deliberately a different
 * formula from the rules-based health score — blending trend, ticket load and
 * engagement recency — so the two can diverge and flag accounts that are about
 * to become a problem.
 */
export function calculatePredictiveRisk(input: PredictiveRiskInput): number {
  let r = 70;
  r += input.trendDelta * 1.6;
  r -= input.openTickets * 4;
  r -= Math.max(0, (input.lastMeetingDays ?? 90) - 30) * 0.35;
  r -= Math.max(0, (input.lastLoginDays ?? 60) - 20) * 0.4;
  r += ((input.nps ?? 0) / 100) * 15;
  r += (input.telemetryScore - 60) * 0.25;
  return clamp(Math.round(r), 2, 98);
}

export type PredictiveRiskLevel = "high" | "elevated" | "low";

export function getPredictiveRiskLevel(predictiveRisk: number): PredictiveRiskLevel {
  if (predictiveRisk < 50) return "high";
  if (predictiveRisk < 70) return "elevated";
  return "low";
}

/** Score change between the most recent value and the value `lookback` points earlier. */
export function calculateTrendDelta(history: readonly number[], lookback = 3): number {
  if (history.length < 2) return 0;
  const latest = history[history.length - 1];
  const earlier = history[Math.max(0, history.length - 1 - lookback)];
  return Math.round(latest - earlier);
}
