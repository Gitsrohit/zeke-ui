import type { HealthBandKey, HealthSourceKey } from "@/config/health";

/**
 * Drive Outcome configuration. Risk types map 1:1 to the health source that
 * is the largest drag on an account; each points to the agent built to work it.
 * Agent references use stable agent keys (seeded per organisation).
 */
export interface RiskTypeDefinition {
  source: HealthSourceKey;
  label: string;
  description: string;
  recommendedAction: string;
  recommendedAgentKey: string;
}

export const RISK_TYPES: Record<HealthSourceKey, RiskTypeDefinition> = {
  telemetry: {
    source: "telemetry",
    label: "Low Product Usage",
    description: "Usage and activation activity is weak relative to entitlement.",
    recommendedAction: "Re-engage admins with usage enablement and office hours; escalate if usage does not recover in 30 days.",
    recommendedAgentKey: "adoption-risk",
  },
  survey: {
    source: "survey",
    label: "Negative Sentiment",
    description: "Survey and NPS responses are trending negative.",
    recommendedAction: "Close the loop with detractors personally within 48 hours and log the root cause.",
    recommendedAgentKey: "close-the-loop",
  },
  meetings: {
    source: "meetings",
    label: "Disengaged Relationship",
    description: "Meeting cadence and engagement with the account team has dropped off.",
    recommendedAction: "Run an account-planning session and secure an executive check-in.",
    recommendedAgentKey: "red-account-review",
  },
  tickets: {
    source: "tickets",
    label: "Support Friction",
    description: "Ticket volume or severity is weighing on the relationship.",
    recommendedAction: "Open an escalation, coordinate a resolution owner and confirm closure with the customer.",
    recommendedAgentKey: "escalation",
  },
  renewal: {
    source: "renewal",
    label: "Renewal Commercial Risk",
    description: "Renewal timing or contract signals are the biggest concern.",
    recommendedAction: "Start the renewal motion early with a value-realisation recap and AM handoff.",
    recommendedAgentKey: "renewal",
  },
  crm: {
    source: "crm",
    label: "Stalled Expansion Signals",
    description: "CRM data shows no active opportunity or sponsor engagement.",
    recommendedAction: "Re-establish executive sponsorship through a structured account review.",
    recommendedAgentKey: "red-account-review",
  },
  hygiene: {
    source: "hygiene",
    label: "Stakeholder Gaps",
    description: "Key contacts are missing, outdated, or unconfirmed.",
    recommendedAction: "Validate the stakeholder map and confirm champions and admins are current.",
    recommendedAgentKey: "handover",
  },
};

/** An account is flagged as "rising risk" when its score exceeds predictive risk by more than this. */
export const PREDICTIVE_DIVERGENCE_THRESHOLD = 12;

export type ExpansionTypeKey = "growthReady" | "renewalAdjacent" | "promoter";

export interface ExpansionTypeDefinition {
  key: ExpansionTypeKey;
  label: string;
  description: string;
  recommendedAgentKey: string;
  /** Illustrative expansion rate applied to ARR — replace with CRM deal data when connected. */
  estimatedExpansionRate: number;
}

export const EXPANSION_TYPES: readonly ExpansionTypeDefinition[] = [
  {
    key: "growthReady",
    label: "Growth-Ready Accounts",
    description: "Thriving accounts already in the Growth lifecycle stage — proven usage, ready for more.",
    recommendedAgentKey: "expansion-play",
    estimatedExpansionRate: 0.18,
  },
  {
    key: "renewalAdjacent",
    label: "Renewal-Adjacent Upsell",
    description: "Healthy accounts renewing soon — the natural moment to expand alongside the renewal conversation.",
    recommendedAgentKey: "renewal",
    estimatedExpansionRate: 0.12,
  },
  {
    key: "promoter",
    label: "Promoter Advocacy",
    description: "Healthy accounts with strongly positive NPS — good candidates for expansion or a reference ask.",
    recommendedAgentKey: "expansion-play",
    estimatedExpansionRate: 0.1,
  },
];

export const EXPANSION_RULES = {
  renewalWindowDays: 120,
  promoterNpsMin: 50,
} as const;

/** Illustrative renewal win probability by health band — replaced by CRM deal stage when connected. */
export const RENEWAL_WIN_PROBABILITY: Record<HealthBandKey, number> = {
  thriving: 0.95,
  stable: 0.85,
  atRisk: 0.55,
  critical: 0.25,
};
