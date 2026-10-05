import { getAudienceField, operatorsForField } from "./fields";
import type { AudienceCondition, AudienceFieldKey, AudienceFilter, AudienceGroup, Combinator } from "./types";

let counter = 0;
/** Client-safe, collision-resistant id for builder nodes. */
export function nodeId(prefix = "n"): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function createCondition(field: AudienceFieldKey = "healthScore", ownerOptions: string[] = []): AudienceCondition {
  const def = getAudienceField(field);
  const operator = operatorsForField(field)[0];
  const firstOption = def.key === "owner" ? ownerOptions[0] : def.options?.[0]?.value;
  return {
    id: nodeId("c"),
    field,
    operator,
    value: def.type === "enum" ? (firstOption ?? "") : field === "healthScore" ? 60 : 0,
  };
}

export function createGroup(combinator: Combinator = "and", conditions: AudienceCondition[] = []): AudienceGroup {
  return { id: nodeId("g"), combinator, conditions, groups: [] };
}

export function createEmptyFilter(): AudienceFilter {
  return { combinator: "or", groups: [createGroup("and", [{ id: nodeId("c"), field: "lifecycle", operator: "equals", value: "Adoption" }])] };
}

/** Normalises a loosely-shaped filter (e.g. from an AI provider) into a complete tree with ids. */
export function normalizeFilter(input: {
  combinator?: Combinator;
  groups: Array<{ combinator?: Combinator; conditions: Array<Omit<AudienceCondition, "id"> & { id?: string }>; groups?: unknown[] }>;
}): AudienceFilter {
  return {
    combinator: input.combinator ?? "or",
    groups: input.groups.map((g) => ({
      id: nodeId("g"),
      combinator: g.combinator ?? "and",
      conditions: g.conditions.map((c) => ({ ...c, id: c.id ?? nodeId("c") })),
      groups: [],
    })),
  };
}
