import { describe, expect, it } from "vitest";
import type { AudienceFilter } from "@/features/audiences/domain/types";
import { coerceValue, conditionErrors, filterReducer, groupDepth, MAX_GROUP_DEPTH } from "./filter-reducer";

const base = (): AudienceFilter => ({
  combinator: "or",
  groups: [{ id: "g1", combinator: "and", conditions: [{ id: "c1", field: "lifecycle", operator: "equals", value: "Adoption" }], groups: [] }],
});

describe("filterReducer", () => {
  it("adds and removes root groups and conditions immutably", () => {
    const start = base();
    const withGroup = filterReducer(start, { type: "addGroup", ownerIds: [] });
    expect(withGroup.groups).toHaveLength(2);
    expect(start.groups).toHaveLength(1);
    const withCond = filterReducer(withGroup, { type: "addCondition", groupId: "g1", ownerIds: [] });
    expect(withCond.groups[0].conditions).toHaveLength(2);
    const removed = filterReducer(withCond, { type: "removeCondition", conditionId: "c1" });
    expect(removed.groups[0].conditions.map((c) => c.id)).not.toContain("c1");
    const noGroup = filterReducer(removed, { type: "removeGroup", groupId: "g1" });
    expect(noGroup.groups).toHaveLength(1);
  });

  it("toggles root and group combinators", () => {
    let s = filterReducer(base(), { type: "setRootCombinator", combinator: "and" });
    s = filterReducer(s, { type: "setGroupCombinator", groupId: "g1", combinator: "or" });
    expect(s.combinator).toBe("and");
    expect(s.groups[0].combinator).toBe("or");
  });

  it("nests groups up to the maximum depth", () => {
    let s = base();
    let parent = "g1";
    for (let i = 0; i < 5; i++) {
      s = filterReducer(s, { type: "addNestedGroup", groupId: parent, ownerIds: [] });
      const findDeepest = (g: AudienceFilter["groups"][number]): string => (g.groups.length ? findDeepest(g.groups[g.groups.length - 1]) : g.id);
      parent = findDeepest(s.groups[0]);
    }
    expect(groupDepth(s, parent)).toBe(MAX_GROUP_DEPTH);
    // nested groups flip the combinator so AND/OR alternate
    expect(s.groups[0].groups[0].combinator).toBe("or");
  });

  it("resets operator and value when the field changes, keeping the id", () => {
    const s = filterReducer(base(), { type: "changeField", conditionId: "c1", field: "healthScore", ownerIds: [] });
    expect(s.groups[0].conditions[0]).toMatchObject({ id: "c1", field: "healthScore", operator: "lessThan", value: 60 });
    const owner = filterReducer(base(), { type: "changeField", conditionId: "c1", field: "owner", ownerIds: ["u1", "u2"] });
    expect(owner.groups[0].conditions[0]).toMatchObject({ field: "owner", operator: "equals", value: "u1" });
  });

  it("coerces values between single and multi operators", () => {
    const s = filterReducer(base(), { type: "changeOperator", conditionId: "c1", operator: "in" });
    expect(s.groups[0].conditions[0].value).toEqual(["Adoption"]);
    const back = filterReducer(s, { type: "changeOperator", conditionId: "c1", operator: "notEquals" });
    expect(back.groups[0].conditions[0].value).toBe("Adoption");
    expect(coerceValue({ id: "x", field: "segment", operator: "equals", value: "" }, "in")).toEqual([]);
  });

  it("rejects operators that do not fit the field", () => {
    const s = filterReducer(base(), { type: "changeOperator", conditionId: "c1", operator: "lessThan" });
    expect(s.groups[0].conditions[0].operator).toBe("equals");
  });

  it("reports per-condition validation errors", () => {
    let s = filterReducer(base(), { type: "changeField", conditionId: "c1", field: "arr", ownerIds: [] });
    s = filterReducer(s, { type: "changeValue", conditionId: "c1", value: "" });
    expect(conditionErrors(s).c1).toContain("needs a number");
    s = filterReducer(s, { type: "changeValue", conditionId: "c1", value: 50000 });
    expect(conditionErrors(s)).toEqual({});
    const multi = filterReducer(base(), { type: "changeOperator", conditionId: "c1", operator: "in" });
    const empty = filterReducer(multi, { type: "changeValue", conditionId: "c1", value: [] });
    expect(conditionErrors(empty).c1).toBeDefined();
  });

  it("replaces the whole filter", () => {
    const next: AudienceFilter = { combinator: "and", groups: [] };
    expect(filterReducer(base(), { type: "replace", filter: next })).toBe(next);
  });
});
