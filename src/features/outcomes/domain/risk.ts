import { getHealthSource, type HealthSourceKey, type SourceWeights } from "@/config/health";
import {
  EXPANSION_RULES,
  EXPANSION_TYPES,
  PREDICTIVE_DIVERGENCE_THRESHOLD,
  RISK_TYPES,
  type ExpansionTypeDefinition,
  type ExpansionTypeKey,
  type RiskTypeDefinition,
} from "@/config/outcomes";
import { findWeakestHealthSignal, isAtRiskBand, type SourceContribution, type SourceScores } from "@/features/health/domain/score";
import type { AccountFacts } from "@/features/audiences/domain/types";

export interface OutcomeAccountInput {
  facts: AccountFacts;
  sources: SourceScores;
  weights: SourceWeights;
}

/** Every recommendation separates what we observed from what we infer and what we suggest. */
export interface RootCause {
  driver: SourceContribution;
  /** Observable fact from the data. */
  observedSignal: string;
  /** Model inference — not a guaranteed fact. */
  inference: string;
  recommendedAction: string;
  recommendedAgentKey: string;
  /** Score is running well above predictive risk: likely to worsen before the score shows it. */
  risingRisk: boolean;
}

export function predictiveDivergence(facts: Pick<AccountFacts, "healthScore" | "predictiveRisk">): number {
  return facts.healthScore - facts.predictiveRisk;
}

export function generateRootCause(input: OutcomeAccountInput): RootCause {
  const driver = findWeakestHealthSignal(input.sources, input.weights);
  const source = getHealthSource(driver.source);
  const meta = RISK_TYPES[driver.source];
  const rising = predictiveDivergence(input.facts) > PREDICTIVE_DIVERGENCE_THRESHOLD;
  const observedSignal = `${source.name} scores ${driver.score}/100 at a ${driver.weight}% weight, costing ${driver.pointsLost.toFixed(1)} points — the largest single drag on this account's health.`;
  let inference = `${meta.label}: ${meta.description}`;
  if (rising) {
    inference += ` Predictive risk (${input.facts.predictiveRisk}) is running well below the current score (${input.facts.healthScore}), which suggests this is likely to get worse before it shows up in the health score.`;
  }
  return {
    driver,
    observedSignal,
    inference,
    recommendedAction: meta.recommendedAction,
    recommendedAgentKey: meta.recommendedAgentKey,
    risingRisk: rising,
  };
}

export interface RiskCandidate {
  facts: AccountFacts;
  rootCause: RootCause;
}

export function isRiskCandidate(facts: AccountFacts): boolean {
  return isAtRiskBand(facts.band) || predictiveDivergence(facts) > PREDICTIVE_DIVERGENCE_THRESHOLD;
}

/** Accounts in At Risk / Critical bands, or whose predictive risk has diverged from their score. */
export function getRiskCandidates(accounts: readonly OutcomeAccountInput[], dismissedAccountIds: ReadonlySet<string> = new Set()): RiskCandidate[] {
  return accounts
    .filter((a) => !dismissedAccountIds.has(a.facts.id) && isRiskCandidate(a.facts))
    .map((a) => ({ facts: a.facts, rootCause: generateRootCause(a) }))
    .sort((a, b) => {
      const div = predictiveDivergence(b.facts) - predictiveDivergence(a.facts);
      return div !== 0 ? div : a.facts.healthScore - b.facts.healthScore;
    });
}

export interface RiskGroup {
  type: RiskTypeDefinition;
  source: HealthSourceKey;
  candidates: RiskCandidate[];
  totalArr: number;
}

/** Groups candidates by their biggest drag so a CSM sees "14 accounts, Low Product Usage". */
export function groupRiskCandidates(candidates: readonly RiskCandidate[]): RiskGroup[] {
  const groups = new Map<HealthSourceKey, RiskGroup>();
  for (const c of candidates) {
    const key = c.rootCause.driver.source;
    const group = groups.get(key) ?? { type: RISK_TYPES[key], source: key, candidates: [], totalArr: 0 };
    group.candidates.push(c);
    group.totalArr += c.facts.arr;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.candidates.length - a.candidates.length || b.totalArr - a.totalArr);
}

function isHealthy(facts: AccountFacts): boolean {
  return facts.band === "thriving" || facts.band === "stable";
}

const EXPANSION_FILTERS: Record<ExpansionTypeKey, (facts: AccountFacts) => boolean> = {
  growthReady: (f) => f.lifecycle === "Growth" && f.band === "thriving",
  renewalAdjacent: (f) => f.renewalInDays !== null && f.renewalInDays <= EXPANSION_RULES.renewalWindowDays && isHealthy(f),
  promoter: (f) => f.nps !== null && f.nps >= EXPANSION_RULES.promoterNpsMin && isHealthy(f),
};

export interface ExpansionGroup {
  type: ExpansionTypeDefinition;
  accounts: AccountFacts[];
  totalArr: number;
  /** Illustrative estimate: ARR × configured expansion rate. */
  estimatedPotential: number;
  observedSignal: string;
}

const EXPANSION_SIGNALS: Record<ExpansionTypeKey, string> = {
  growthReady: "In the Growth lifecycle stage with a Thriving health band.",
  renewalAdjacent: `Renewing within ${EXPANSION_RULES.renewalWindowDays} days with a Thriving or Stable health band.`,
  promoter: `NPS of ${EXPANSION_RULES.promoterNpsMin}+ with a Thriving or Stable health band.`,
};

export function getExpansionCandidates(accounts: readonly AccountFacts[]): ExpansionGroup[] {
  return EXPANSION_TYPES.map((type) => {
    const matched = accounts.filter(EXPANSION_FILTERS[type.key]);
    const totalArr = matched.reduce((sum, a) => sum + a.arr, 0);
    return {
      type,
      accounts: matched,
      totalArr,
      estimatedPotential: totalArr * type.estimatedExpansionRate,
      observedSignal: EXPANSION_SIGNALS[type.key],
    };
  });
}
