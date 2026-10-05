import { getAudienceField, OPERATOR_LABELS } from "./fields";
import type { AccountFacts, AudienceCondition, AudienceFilter, AudienceGroup, Combinator } from "./types";

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toList(value: AudienceCondition["value"]): string[] {
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/**
 * Evaluates a single condition against an account. Missing values (null) never
 * satisfy comparisons; `notEquals` / `notIn` treat a missing value as "not equal".
 */
export function evaluateCondition(facts: AccountFacts, condition: AudienceCondition): boolean {
  const field = getAudienceField(condition.field);
  const actual = field.read(facts);

  if (field.type === "enum") {
    const actualStr = actual === null ? null : String(actual);
    switch (condition.operator) {
      case "equals":
        return actualStr !== null && actualStr === String(condition.value);
      case "notEquals":
        return actualStr === null || actualStr !== String(condition.value);
      case "in":
        return actualStr !== null && toList(condition.value).includes(actualStr);
      case "notIn":
        return actualStr === null || !toList(condition.value).includes(actualStr);
      default:
        return false;
    }
  }

  const actualNum = toNumber(actual);
  const expected = toNumber(condition.value);
  if (condition.operator === "notEquals") return actualNum === null || expected === null || actualNum !== expected;
  if (actualNum === null || expected === null) return false;
  switch (condition.operator) {
    case "equals":
      return actualNum === expected;
    case "lessThan":
      return actualNum < expected;
    case "greaterThan":
      return actualNum > expected;
    case "lessThanOrEqual":
      return actualNum <= expected;
    case "greaterThanOrEqual":
      return actualNum >= expected;
    default:
      return false;
  }
}

function combine(results: boolean[], combinator: Combinator): boolean {
  return combinator === "and" ? results.every(Boolean) : results.some(Boolean);
}

/** An empty group matches every account. */
export function evaluateGroup(facts: AccountFacts, group: AudienceGroup): boolean {
  const results = [
    ...group.conditions.map((c) => evaluateCondition(facts, c)),
    ...group.groups.map((g) => evaluateGroup(facts, g)),
  ];
  if (results.length === 0) return true;
  return combine(results, group.combinator);
}

export function matchesAudience(facts: AccountFacts, filter: AudienceFilter): boolean {
  if (filter.groups.length === 0) return true;
  return combine(
    filter.groups.map((g) => evaluateGroup(facts, g)),
    filter.combinator,
  );
}

export function evaluateAudience<T extends AccountFacts>(accounts: readonly T[], filter: AudienceFilter): T[] {
  return accounts.filter((a) => matchesAudience(a, filter));
}

export function countConditions(filter: AudienceFilter): number {
  const countGroup = (g: AudienceGroup): number => g.conditions.length + g.groups.reduce((n, sub) => n + countGroup(sub), 0);
  return filter.groups.reduce((n, g) => n + countGroup(g), 0);
}

export function flattenConditions(filter: AudienceFilter): AudienceCondition[] {
  const walk = (g: AudienceGroup): AudienceCondition[] => [...g.conditions, ...g.groups.flatMap(walk)];
  return filter.groups.flatMap(walk);
}

export interface DescribeOptions {
  ownerNames?: Record<string, string>;
}

export function describeCondition(condition: AudienceCondition, options: DescribeOptions = {}): string {
  const field = getAudienceField(condition.field);
  const label = (v: string) => {
    if (condition.field === "owner") return options.ownerNames?.[v] ?? "Unknown owner";
    return field.options?.find((o) => o.value === v)?.label ?? v;
  };
  const value = Array.isArray(condition.value)
    ? condition.value.map((v) => label(String(v))).join(", ")
    : field.type === "enum"
      ? label(String(condition.value))
      : condition.field === "arr"
        ? `$${Number(condition.value).toLocaleString("en-US")}`
        : String(condition.value);
  return `${field.label} ${OPERATOR_LABELS[condition.operator]} ${value}`;
}
