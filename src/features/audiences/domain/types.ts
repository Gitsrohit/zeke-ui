import type { HealthBandKey, HealthSourceKey } from "@/config/health";

export const AUDIENCE_OPERATORS = [
  "equals",
  "notEquals",
  "lessThan",
  "greaterThan",
  "lessThanOrEqual",
  "greaterThanOrEqual",
  "in",
  "notIn",
] as const;
export type AudienceOperator = (typeof AUDIENCE_OPERATORS)[number];

export const AUDIENCE_FIELD_KEYS = [
  "lifecycle",
  "segment",
  "band",
  "healthScore",
  "predictiveRisk",
  "owner",
  "lastMeetingDays",
  "lastLoginDays",
  "openTickets",
  "nps",
  "renewalInDays",
  "arr",
  "weakestSource",
] as const;
export type AudienceFieldKey = (typeof AUDIENCE_FIELD_KEYS)[number];

export type AudienceConditionValue = string | number | string[];

export type Combinator = "and" | "or";

export interface AudienceCondition {
  id: string;
  field: AudienceFieldKey;
  operator: AudienceOperator;
  value: AudienceConditionValue;
}

/** A group combines its conditions and nested groups with a single combinator. */
export interface AudienceGroup {
  id: string;
  combinator: Combinator;
  conditions: AudienceCondition[];
  groups: AudienceGroup[];
}

/** Root filter: root groups are combined with `combinator` (OR by default). */
export interface AudienceFilter {
  combinator: Combinator;
  groups: AudienceGroup[];
}

/** Flattened, evaluable view of an account used by audience evaluation and agent conditions. */
export interface AccountFacts {
  id: string;
  name: string;
  lifecycle: string;
  segment: string;
  band: HealthBandKey;
  healthScore: number;
  predictiveRisk: number;
  ownerId: string | null;
  ownerName: string | null;
  lastMeetingDays: number | null;
  lastLoginDays: number | null;
  openTickets: number;
  nps: number | null;
  renewalInDays: number | null;
  arr: number;
  weakestSource: HealthSourceKey | null;
}

export type AudienceType = "dynamic" | "static";
