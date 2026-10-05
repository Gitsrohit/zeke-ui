import { describe, expect, it } from "vitest";
import { countConditions, describeCondition, evaluateAudience, evaluateCondition, matchesAudience } from "./evaluate";
import { audienceFilterSchema } from "../schemas";
import type { AccountFacts, AudienceCondition, AudienceFilter } from "./types";

function facts(overrides: Partial<AccountFacts> = {}): AccountFacts {
  return {
    id: "a1",
    name: "Meridian Health Systems",
    lifecycle: "Adoption",
    segment: "Enterprise",
    band: "atRisk",
    healthScore: 52,
    predictiveRisk: 40,
    ownerId: "u1",
    ownerName: "Maya Chen",
    lastMeetingDays: 45,
    lastLoginDays: 3,
    openTickets: 2,
    nps: 10,
    renewalInDays: 200,
    arr: 210_000,
    weakestSource: "telemetry",
    ...overrides,
  };
}

const cond = (c: Omit<AudienceCondition, "id">): AudienceCondition => ({ id: "c", ...c });

describe("evaluateCondition", () => {
  it("handles enum equals / notEquals / in / notIn", () => {
    expect(evaluateCondition(facts(), cond({ field: "segment", operator: "equals", value: "Enterprise" }))).toBe(true);
    expect(evaluateCondition(facts(), cond({ field: "segment", operator: "notEquals", value: "Enterprise" }))).toBe(false);
    expect(evaluateCondition(facts(), cond({ field: "lifecycle", operator: "in", value: ["Growth", "Adoption"] }))).toBe(true);
    expect(evaluateCondition(facts(), cond({ field: "lifecycle", operator: "notIn", value: ["Growth", "Adoption"] }))).toBe(false);
    expect(evaluateCondition(facts(), cond({ field: "band", operator: "equals", value: "atRisk" }))).toBe(true);
    expect(evaluateCondition(facts(), cond({ field: "owner", operator: "equals", value: "u1" }))).toBe(true);
  });

  it("handles numeric comparisons, including string-typed values from forms", () => {
    expect(evaluateCondition(facts(), cond({ field: "healthScore", operator: "lessThan", value: 60 }))).toBe(true);
    expect(evaluateCondition(facts(), cond({ field: "healthScore", operator: "lessThan", value: "52" }))).toBe(false);
    expect(evaluateCondition(facts(), cond({ field: "healthScore", operator: "lessThanOrEqual", value: "52" }))).toBe(true);
    expect(evaluateCondition(facts(), cond({ field: "arr", operator: "greaterThan", value: 50_000 }))).toBe(true);
    expect(evaluateCondition(facts(), cond({ field: "lastMeetingDays", operator: "greaterThan", value: 30 }))).toBe(true);
    expect(evaluateCondition(facts(), cond({ field: "openTickets", operator: "equals", value: 2 }))).toBe(true);
  });

  it("never matches comparisons against missing values, but treats them as not-equal", () => {
    const f = facts({ nps: null, renewalInDays: null });
    expect(evaluateCondition(f, cond({ field: "nps", operator: "greaterThan", value: -100 }))).toBe(false);
    expect(evaluateCondition(f, cond({ field: "renewalInDays", operator: "lessThan", value: 9999 }))).toBe(false);
    expect(evaluateCondition(f, cond({ field: "nps", operator: "notEquals", value: 10 }))).toBe(true);
  });

  it("does not match non-numeric input for numeric fields", () => {
    expect(evaluateCondition(facts(), cond({ field: "healthScore", operator: "lessThan", value: "abc" }))).toBe(false);
  });
});

describe("matchesAudience", () => {
  const spec: AudienceFilter = {
    combinator: "or",
    groups: [
      {
        id: "g1",
        combinator: "and",
        conditions: [
          cond({ field: "segment", operator: "equals", value: "Enterprise" }),
          cond({ field: "lifecycle", operator: "equals", value: "Adoption" }),
          cond({ field: "healthScore", operator: "lessThan", value: 60 }),
          cond({ field: "lastMeetingDays", operator: "greaterThan", value: 30 }),
        ],
        groups: [],
      },
    ],
  };

  it("ANDs conditions within a group", () => {
    expect(matchesAudience(facts(), spec)).toBe(true);
    expect(matchesAudience(facts({ lastMeetingDays: 10 }), spec)).toBe(false);
  });

  it("ORs root groups", () => {
    const filter: AudienceFilter = {
      combinator: "or",
      groups: [
        { id: "g1", combinator: "and", conditions: [cond({ field: "renewalInDays", operator: "lessThan", value: 90 })], groups: [] },
        { id: "g2", combinator: "and", conditions: [cond({ field: "band", operator: "equals", value: "critical" })], groups: [] },
      ],
    };
    expect(matchesAudience(facts({ renewalInDays: 30, band: "stable" }), filter)).toBe(true);
    expect(matchesAudience(facts({ renewalInDays: 300, band: "critical" }), filter)).toBe(true);
    expect(matchesAudience(facts({ renewalInDays: 300, band: "stable" }), filter)).toBe(false);
  });

  it("supports nested groups with their own combinator", () => {
    // Enterprise AND (score < 40 OR open tickets > 3)
    const filter: AudienceFilter = {
      combinator: "and",
      groups: [
        {
          id: "g1",
          combinator: "and",
          conditions: [cond({ field: "segment", operator: "equals", value: "Enterprise" })],
          groups: [
            {
              id: "g1a",
              combinator: "or",
              conditions: [
                cond({ field: "healthScore", operator: "lessThan", value: 40 }),
                cond({ field: "openTickets", operator: "greaterThan", value: 3 }),
              ],
              groups: [],
            },
          ],
        },
      ],
    };
    expect(matchesAudience(facts({ healthScore: 30, openTickets: 0 }), filter)).toBe(true);
    expect(matchesAudience(facts({ healthScore: 70, openTickets: 5 }), filter)).toBe(true);
    expect(matchesAudience(facts({ healthScore: 70, openTickets: 1 }), filter)).toBe(false);
    expect(matchesAudience(facts({ segment: "SMB", healthScore: 30 }), filter)).toBe(false);
    expect(countConditions(filter)).toBe(3);
  });

  it("empty filters and empty groups match everything", () => {
    expect(matchesAudience(facts(), { combinator: "or", groups: [] })).toBe(true);
    expect(matchesAudience(facts(), { combinator: "or", groups: [{ id: "g", combinator: "and", conditions: [], groups: [] }] })).toBe(true);
  });

  it("filters a list of accounts", () => {
    const list = [facts({ id: "a" }), facts({ id: "b", segment: "SMB" }), facts({ id: "c", healthScore: 90 })];
    expect(evaluateAudience(list, spec).map((a) => a.id)).toEqual(["a"]);
  });
});

describe("audienceFilterSchema", () => {
  it("accepts a valid filter", () => {
    const parsed = audienceFilterSchema.safeParse({
      combinator: "or",
      groups: [{ id: "g", combinator: "and", conditions: [{ id: "c", field: "healthScore", operator: "lessThan", value: 60 }], groups: [] }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects operators that do not fit the field and malformed values", () => {
    const bad = (condition: Record<string, unknown>) =>
      audienceFilterSchema.safeParse({ combinator: "or", groups: [{ id: "g", combinator: "and", conditions: [{ id: "c", ...condition }], groups: [] }] }).success;
    expect(bad({ field: "segment", operator: "lessThan", value: "SMB" })).toBe(false);
    expect(bad({ field: "segment", operator: "in", value: "SMB" })).toBe(false);
    expect(bad({ field: "segment", operator: "in", value: [] })).toBe(false);
    expect(bad({ field: "healthScore", operator: "lessThan", value: "sixty" })).toBe(false);
    expect(bad({ field: "unknown", operator: "equals", value: "x" })).toBe(false);
  });

  it("rejects groups nested deeper than 3 levels", () => {
    const g = (groups: unknown[]) => ({ id: "g", combinator: "and", conditions: [], groups });
    const parsed = audienceFilterSchema.safeParse({ combinator: "or", groups: [g([g([g([g([])])])])] });
    expect(parsed.success).toBe(false);
  });
});

describe("describeCondition", () => {
  it("renders human-readable labels", () => {
    expect(describeCondition(cond({ field: "band", operator: "equals", value: "atRisk" }))).toBe("Health Category is At Risk");
    expect(describeCondition(cond({ field: "arr", operator: "greaterThan", value: 50000 }))).toBe("ARR ($) greater than $50,000");
    expect(describeCondition(cond({ field: "owner", operator: "equals", value: "u1" }), { ownerNames: { u1: "Maya Chen" } })).toBe("CSM Owner is Maya Chen");
  });
});
