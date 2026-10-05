import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, type SourceWeights } from "@/config/health";
import {
  calculateContributions,
  calculateHealthScore,
  calculatePredictiveRisk,
  calculateTrendDelta,
  findWeakestHealthSignal,
  getHealthBand,
  getPredictiveRiskLevel,
  validateBandThresholds,
  validateWeights,
  type SourceScores,
} from "./score";
import { metricRawFromScore, metricScoreFromRaw, sourceScoreFromMetrics } from "./metrics";
import { SUB_METRICS } from "@/config/health";

const sources: SourceScores = { telemetry: 48, survey: 70, meetings: 80, tickets: 60, renewal: 90, crm: 55, hygiene: 75 };

describe("calculateHealthScore", () => {
  it("computes a weighted average", () => {
    // Adoption: 30/15/15/15/10/10/5
    const expected = Math.round((48 * 30 + 70 * 15 + 80 * 15 + 60 * 15 + 55 * 10 + 75 * 10 + 90 * 5) / 100);
    expect(calculateHealthScore(sources, DEFAULT_WEIGHTS.Adoption)).toBe(expected);
  });

  it("normalises weights that do not sum to 100", () => {
    const halfWeights = Object.fromEntries(Object.entries(DEFAULT_WEIGHTS.Adoption).map(([k, v]) => [k, v / 2])) as SourceWeights;
    expect(calculateHealthScore(sources, halfWeights)).toBe(calculateHealthScore(sources, DEFAULT_WEIGHTS.Adoption));
  });

  it("returns 0 when all weights are zero", () => {
    expect(calculateHealthScore(sources, { telemetry: 0 })).toBe(0);
  });

  it("treats missing sources as 0", () => {
    expect(calculateHealthScore({ telemetry: 100 }, { telemetry: 50, survey: 50 })).toBe(50);
  });
});

describe("getHealthBand", () => {
  it.each([
    [100, "thriving"],
    [80, "thriving"],
    [79, "stable"],
    [60, "stable"],
    [59, "atRisk"],
    [40, "atRisk"],
    [39, "critical"],
    [0, "critical"],
  ])("score %i → %s with default thresholds", (score, band) => {
    expect(getHealthBand(score)).toBe(band);
  });

  it("respects custom thresholds", () => {
    const t = { thriving: 90, stable: 70, atRisk: 50 };
    expect(getHealthBand(85, t)).toBe("stable");
    expect(getHealthBand(55, t)).toBe("atRisk");
    expect(getHealthBand(49, t)).toBe("critical");
  });
});

describe("validateWeights", () => {
  it("accepts every default lifecycle profile", () => {
    for (const weights of Object.values(DEFAULT_WEIGHTS)) {
      expect(validateWeights(weights)).toMatchObject({ valid: true, total: 100 });
    }
  });

  it("rejects weights that do not total 100", () => {
    const result = validateWeights({ ...DEFAULT_WEIGHTS.Adoption, telemetry: 40 });
    expect(result.valid).toBe(false);
    expect(result.total).toBe(110);
    expect(result.errors.join()).toContain("110");
  });

  it("rejects negative, fractional and missing weights", () => {
    expect(validateWeights({ ...DEFAULT_WEIGHTS.Adoption, telemetry: -5, survey: 50 }).valid).toBe(false);
    expect(validateWeights({ ...DEFAULT_WEIGHTS.Adoption, telemetry: 29.5, survey: 15.5 }).valid).toBe(false);
    const { telemetry: _omit, ...missing } = DEFAULT_WEIGHTS.Adoption;
    void _omit;
    expect(validateWeights(missing).errors.join()).toContain("Missing weight for telemetry");
  });
});

describe("validateBandThresholds", () => {
  it("requires strictly descending minimums", () => {
    expect(validateBandThresholds({ thriving: 80, stable: 60, atRisk: 40 }).valid).toBe(true);
    expect(validateBandThresholds({ thriving: 60, stable: 60, atRisk: 40 }).valid).toBe(false);
    expect(validateBandThresholds({ thriving: 80, stable: 30, atRisk: 40 }).valid).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(validateBandThresholds({ thriving: 100, stable: 60, atRisk: 40 }).valid).toBe(false);
    expect(validateBandThresholds({ thriving: 80, stable: 60, atRisk: 0 }).valid).toBe(false);
  });
});

describe("contributions and weakest signal", () => {
  it("points plus points lost equal each source's normalised weight", () => {
    const contributions = calculateContributions(sources, DEFAULT_WEIGHTS.Adoption);
    for (const c of contributions) expect(c.points + c.pointsLost).toBeCloseTo(c.normalizedWeight);
    const total = contributions.reduce((s, c) => s + c.points, 0);
    expect(Math.round(total)).toBe(calculateHealthScore(sources, DEFAULT_WEIGHTS.Adoption));
  });

  it("finds the source losing the most weighted points, not the lowest raw score", () => {
    // crm (55) is lower-scoring than tickets in some setups, but telemetry at 30% weight loses the most.
    expect(findWeakestHealthSignal(sources, DEFAULT_WEIGHTS.Adoption).source).toBe("telemetry");
    // With renewal weighting, a heavily weighted mediocre source dominates.
    const renewalSources: SourceScores = { ...sources, telemetry: 90, renewal: 50 };
    expect(findWeakestHealthSignal(renewalSources, DEFAULT_WEIGHTS.Renewal).source).toBe("renewal");
  });
});

describe("calculatePredictiveRisk", () => {
  const base = { trendDelta: 0, openTickets: 0, lastMeetingDays: 10, lastLoginDays: 5, nps: 0, telemetryScore: 60 };

  it("is 70 for a neutral account", () => {
    expect(calculatePredictiveRisk(base)).toBe(70);
  });

  it("falls with tickets, stale engagement and negative trend", () => {
    expect(calculatePredictiveRisk({ ...base, openTickets: 5 })).toBe(50);
    expect(calculatePredictiveRisk({ ...base, trendDelta: -10 })).toBe(54);
    expect(calculatePredictiveRisk({ ...base, lastMeetingDays: 70 })).toBe(56);
  });

  it("is clamped to 2–98", () => {
    expect(calculatePredictiveRisk({ ...base, trendDelta: 50, nps: 100, telemetryScore: 100 })).toBe(98);
    expect(calculatePredictiveRisk({ ...base, trendDelta: -50, openTickets: 20 })).toBe(2);
  });

  it("classifies levels", () => {
    expect(getPredictiveRiskLevel(30)).toBe("high");
    expect(getPredictiveRiskLevel(60)).toBe("elevated");
    expect(getPredictiveRiskLevel(85)).toBe("low");
  });
});

describe("calculateTrendDelta", () => {
  it("compares latest value with the value N points earlier", () => {
    expect(calculateTrendDelta([50, 55, 60, 62, 70], 3)).toBe(15);
    expect(calculateTrendDelta([70], 3)).toBe(0);
    expect(calculateTrendDelta([80, 60], 3)).toBe(-20);
  });
});

describe("sub-metric normalisation", () => {
  it("round-trips raw ↔ score, including lower-is-better and segment-scaled measures", () => {
    for (const def of SUB_METRICS.telemetry) {
      const raw = metricRawFromScore(def, "Mid-Market", 64);
      expect(metricScoreFromRaw(def, "Mid-Market", raw)).toBeCloseTo(64);
    }
  });

  it("source score equals the weighted average of sub-metric scores", () => {
    const defs = SUB_METRICS.survey;
    expect(sourceScoreFromMetrics(defs, defs.map(() => 70))).toBeCloseTo(70);
  });
});
