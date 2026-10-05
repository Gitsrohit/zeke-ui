import { createCondition, createGroup } from "@/features/audiences/domain/builders";
import { getAudienceField, operatorsForField } from "@/features/audiences/domain/fields";
import type {
  AudienceCondition,
  AudienceFieldKey,
  AudienceFilter,
  AudienceGroup,
  AudienceOperator,
  Combinator,
} from "@/features/audiences/domain/types";
import { audienceConditionSchema } from "@/features/audiences/schemas";

export const MAX_GROUP_DEPTH = 3;

export type FilterAction =
  | { type: "replace"; filter: AudienceFilter }
  | { type: "setRootCombinator"; combinator: Combinator }
  | { type: "addGroup"; ownerIds: string[] }
  | { type: "removeGroup"; groupId: string }
  | { type: "setGroupCombinator"; groupId: string; combinator: Combinator }
  | { type: "addCondition"; groupId: string; ownerIds: string[] }
  | { type: "addNestedGroup"; groupId: string; ownerIds: string[] }
  | { type: "removeCondition"; conditionId: string }
  | { type: "changeField"; conditionId: string; field: AudienceFieldKey; ownerIds: string[] }
  | { type: "changeOperator"; conditionId: string; operator: AudienceOperator }
  | { type: "changeValue"; conditionId: string; value: AudienceCondition["value"] };

const isMulti = (op: AudienceOperator) => op === "in" || op === "notIn";

function mapGroup(group: AudienceGroup, fn: (g: AudienceGroup) => AudienceGroup): AudienceGroup {
  const next = fn(group);
  return { ...next, groups: next.groups.map((g) => mapGroup(g, fn)) };
}

function mapAllGroups(filter: AudienceFilter, fn: (g: AudienceGroup) => AudienceGroup): AudienceFilter {
  return { ...filter, groups: filter.groups.map((g) => mapGroup(g, fn)) };
}

function mapCondition(filter: AudienceFilter, conditionId: string, fn: (c: AudienceCondition) => AudienceCondition): AudienceFilter {
  return mapAllGroups(filter, (g) =>
    g.conditions.some((c) => c.id === conditionId) ? { ...g, conditions: g.conditions.map((c) => (c.id === conditionId ? fn(c) : c)) } : g,
  );
}

/** Depth of the group with `groupId` (root groups = 1), or 0 if absent. */
export function groupDepth(filter: AudienceFilter, groupId: string): number {
  const walk = (groups: AudienceGroup[], depth: number): number => {
    for (const g of groups) {
      if (g.id === groupId) return depth;
      const found = walk(g.groups, depth + 1);
      if (found) return found;
    }
    return 0;
  };
  return walk(filter.groups, 1);
}

/** Converts a condition's value when the operator switches between single- and multi-value. */
export function coerceValue(condition: AudienceCondition, operator: AudienceOperator): AudienceCondition["value"] {
  const { value } = condition;
  if (isMulti(operator)) return Array.isArray(value) ? value : value === "" ? [] : [String(value)];
  if (Array.isArray(value)) return value[0] ?? "";
  return value;
}

export function filterReducer(state: AudienceFilter, action: FilterAction): AudienceFilter {
  switch (action.type) {
    case "replace":
      return action.filter;
    case "setRootCombinator":
      return { ...state, combinator: action.combinator };
    case "addGroup":
      return { ...state, groups: [...state.groups, createGroup("and", [createCondition("healthScore", action.ownerIds)])] };
    case "removeGroup": {
      const prune = (groups: AudienceGroup[]): AudienceGroup[] => groups.filter((g) => g.id !== action.groupId).map((g) => ({ ...g, groups: prune(g.groups) }));
      return { ...state, groups: prune(state.groups) };
    }
    case "setGroupCombinator":
      return mapAllGroups(state, (g) => (g.id === action.groupId ? { ...g, combinator: action.combinator } : g));
    case "addCondition":
      return mapAllGroups(state, (g) => (g.id === action.groupId ? { ...g, conditions: [...g.conditions, createCondition("healthScore", action.ownerIds)] } : g));
    case "addNestedGroup": {
      if (groupDepth(state, action.groupId) >= MAX_GROUP_DEPTH) return state;
      return mapAllGroups(state, (g) =>
        g.id === action.groupId ? { ...g, groups: [...g.groups, createGroup(g.combinator === "and" ? "or" : "and", [createCondition("healthScore", action.ownerIds)])] } : g,
      );
    }
    case "removeCondition":
      return mapAllGroups(state, (g) => ({ ...g, conditions: g.conditions.filter((c) => c.id !== action.conditionId) }));
    case "changeField":
      return mapCondition(state, action.conditionId, (c) => ({ ...createCondition(action.field, action.ownerIds), id: c.id }));
    case "changeOperator":
      return mapCondition(state, action.conditionId, (c) => {
        const allowed = operatorsForField(c.field);
        const operator = allowed.includes(action.operator) ? action.operator : allowed[0];
        return { ...c, operator, value: coerceValue(c, operator) };
      });
    case "changeValue":
      return mapCondition(state, action.conditionId, (c) => ({ ...c, value: action.value }));
  }
}

/** Per-condition validation messages keyed by condition id. */
export function conditionErrors(filter: AudienceFilter): Record<string, string> {
  const errors: Record<string, string> = {};
  const walk = (groups: AudienceGroup[]) => {
    for (const g of groups) {
      for (const c of g.conditions) {
        const field = getAudienceField(c.field);
        if (field.type === "number" && !Array.isArray(c.value) && String(c.value).trim() === "") {
          errors[c.id] = `${field.label} needs a number`;
          continue;
        }
        const result = audienceConditionSchema.safeParse(c);
        if (!result.success) errors[c.id] = result.error.issues[0]?.message ?? "Invalid condition";
      }
      walk(g.groups);
    }
  };
  walk(filter.groups);
  return errors;
}
