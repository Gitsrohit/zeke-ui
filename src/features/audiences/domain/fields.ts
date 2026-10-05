import { HEALTH_BAND_ORDER, HEALTH_BANDS, HEALTH_SOURCES, LIFECYCLE_STAGES, SEGMENTS } from "@/config/health";
import type { AccountFacts, AudienceFieldKey, AudienceOperator } from "./types";

export interface FieldOption {
  value: string;
  label: string;
}

export interface AudienceFieldDefinition {
  key: AudienceFieldKey;
  label: string;
  type: "enum" | "number";
  /** Static options; `owner` options are supplied at runtime from the organisation's users. */
  options?: readonly FieldOption[];
  unit?: string;
  read: (facts: AccountFacts) => string | number | null;
}

const ENUM_OPERATORS: readonly AudienceOperator[] = ["equals", "notEquals", "in", "notIn"];
const NUMBER_OPERATORS: readonly AudienceOperator[] = [
  "lessThan",
  "greaterThan",
  "lessThanOrEqual",
  "greaterThanOrEqual",
  "equals",
  "notEquals",
];

export const AUDIENCE_FIELDS: readonly AudienceFieldDefinition[] = [
  { key: "lifecycle", label: "Lifecycle Stage", type: "enum", options: LIFECYCLE_STAGES.map((v) => ({ value: v, label: v })), read: (f) => f.lifecycle },
  { key: "segment", label: "ARR Segment", type: "enum", options: SEGMENTS.map((v) => ({ value: v, label: v })), read: (f) => f.segment },
  { key: "band", label: "Health Category", type: "enum", options: HEALTH_BAND_ORDER.map((k) => ({ value: k, label: HEALTH_BANDS[k].label })), read: (f) => f.band },
  { key: "healthScore", label: "Health Score", type: "number", read: (f) => f.healthScore },
  { key: "predictiveRisk", label: "Predictive Risk Score", type: "number", read: (f) => f.predictiveRisk },
  { key: "owner", label: "CSM Owner", type: "enum", read: (f) => f.ownerId },
  { key: "lastMeetingDays", label: "Last Meeting (days ago)", type: "number", unit: "days", read: (f) => f.lastMeetingDays },
  { key: "lastLoginDays", label: "Last Login (days ago)", type: "number", unit: "days", read: (f) => f.lastLoginDays },
  { key: "openTickets", label: "Open Tickets", type: "number", read: (f) => f.openTickets },
  { key: "nps", label: "NPS Score", type: "number", read: (f) => f.nps },
  { key: "renewalInDays", label: "Renewal In (days)", type: "number", unit: "days", read: (f) => f.renewalInDays },
  { key: "arr", label: "ARR ($)", type: "number", read: (f) => f.arr },
  { key: "weakestSource", label: "Weakest Health Signal", type: "enum", options: HEALTH_SOURCES.map((s) => ({ value: s.key, label: s.name })), read: (f) => f.weakestSource },
];

export function getAudienceField(key: AudienceFieldKey): AudienceFieldDefinition {
  const field = AUDIENCE_FIELDS.find((f) => f.key === key);
  if (!field) throw new Error(`Unknown audience field: ${key}`);
  return field;
}

export function operatorsForField(key: AudienceFieldKey): readonly AudienceOperator[] {
  return getAudienceField(key).type === "enum" ? ENUM_OPERATORS : NUMBER_OPERATORS;
}

export const OPERATOR_LABELS: Record<AudienceOperator, string> = {
  equals: "is",
  notEquals: "is not",
  lessThan: "less than",
  greaterThan: "greater than",
  lessThanOrEqual: "at most",
  greaterThanOrEqual: "at least",
  in: "is any of",
  notIn: "is none of",
};

export const OPERATOR_SYMBOLS: Record<AudienceOperator, string> = {
  equals: "=",
  notEquals: "≠",
  lessThan: "<",
  greaterThan: ">",
  lessThanOrEqual: "≤",
  greaterThanOrEqual: "≥",
  in: "in",
  notIn: "not in",
};
