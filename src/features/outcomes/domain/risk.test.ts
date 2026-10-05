import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/config/health";
import type { AccountFacts } from "@/features/audiences/domain/types";
import { generateRootCause, getExpansionCandidates, getRiskCandidates, groupRiskCandidates, type OutcomeAccountInput } from "./risk";

function facts(overrides: Partial<AccountFacts>): AccountFacts {
  return {
    id: "a",
    name: "Acme",
    lifecycle: "Adoption",
    segment: "Enterprise",
    band: "stable",
    healthScore: 70,
    predictiveRisk: 68,
    ownerId: null,
    ownerName: null,
    lastMeetingDays: 10,
    lastLoginDays: 2,
    openTickets: 0,
    nps: 20,
    renewalInDays: 300,
    arr: 100_000,
    weakestSource: null,
    ...overrides,
  };
}

const strong = { telemetry: 85, survey: 85, meetings: 85, tickets: 85, renewal: 85, crm: 85, hygiene: 85 };

function input(f: Partial<AccountFacts>, sources: Partial<typeof strong> = {}): OutcomeAccountInput {
  return { facts: facts(f), sources: { ...strong, ...sources }, weights: DEFAULT_WEIGHTS.Adoption };
}

describe("getRiskCandidates", () => {
  it("flags at-risk and critical bands, and rising predictive risk", () => {
    const list = [
      input({ id: "healthy", band: "thriving", healthScore: 85, predictiveRisk: 82 }),
      input({ id: "atRisk", band: "atRisk", healthScore: 50, predictiveRisk: 48 }),
      input({ id: "critical", band: "critical", healthScore: 30, predictiveRisk: 25 }),
      input({ id: "rising", band: "stable", healthScore: 70, predictiveRisk: 40 }),
    ];
    const ids = getRiskCandidates(list).map((c) => c.facts.id);
    expect(ids).toEqual(expect.arrayContaining(["atRisk", "critical", "rising"]));
    expect(ids).not.toContain("healthy");
    // Largest divergence first.
    expect(ids[0]).toBe("rising");
  });

  it("excludes dismissed accounts", () => {
    const list = [input({ id: "x", band: "critical", healthScore: 20, predictiveRisk: 20 })];
    expect(getRiskCandidates(list, new Set(["x"]))).toHaveLength(0);
  });
});

describe("generateRootCause", () => {
  it("separates observed signal, inference and recommendation", () => {
    const rc = generateRootCause(input({ band: "atRisk", healthScore: 50, predictiveRisk: 30 }, { telemetry: 20 }));
    expect(rc.driver.source).toBe("telemetry");
    expect(rc.observedSignal).toContain("20/100");
    expect(rc.inference).toContain("Low Product Usage");
    expect(rc.inference).toContain("likely to get worse");
    expect(rc.recommendedAgentKey).toBe("adoption-risk");
    expect(rc.risingRisk).toBe(true);
  });
});

describe("groupRiskCandidates", () => {
  it("groups by driver with ARR totals, largest group first", () => {
    const list = [
      input({ id: "1", band: "atRisk", arr: 10 }, { telemetry: 10 }),
      input({ id: "2", band: "atRisk", arr: 20 }, { telemetry: 15 }),
      input({ id: "3", band: "critical", arr: 50 }, { tickets: 0 }),
    ];
    const groups = groupRiskCandidates(getRiskCandidates(list));
    expect(groups.map((g) => [g.source, g.candidates.length, g.totalArr])).toEqual([
      ["telemetry", 2, 30],
      ["tickets", 1, 50],
    ]);
    expect(groups[0].type.label).toBe("Low Product Usage");
  });
});

describe("getExpansionCandidates", () => {
  it("applies each expansion rule and estimates potential", () => {
    const accounts = [
      facts({ id: "growth", lifecycle: "Growth", band: "thriving", arr: 100_000 }),
      facts({ id: "renewing", band: "stable", renewalInDays: 60, arr: 50_000 }),
      facts({ id: "promoter", band: "thriving", nps: 70, arr: 40_000 }),
      facts({ id: "unhealthy-promoter", band: "atRisk", nps: 90 }),
    ];
    const groups = Object.fromEntries(getExpansionCandidates(accounts).map((g) => [g.type.key, g]));
    expect(groups.growthReady.accounts.map((a) => a.id)).toEqual(["growth"]);
    expect(groups.growthReady.estimatedPotential).toBeCloseTo(18_000);
    expect(groups.renewalAdjacent.accounts.map((a) => a.id)).toEqual(["renewing"]);
    expect(groups.promoter.accounts.map((a) => a.id)).toEqual(["promoter"]);
  });
});
