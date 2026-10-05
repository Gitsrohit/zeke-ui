import { describe, expect, it } from "vitest";
import {
  checkAgentConflict,
  checkAgentCooldown,
  checkAgentEligibility,
  evaluateLaunch,
  planLaunch,
  type OrchestrationAccount,
  type OrchestrationAgent,
  type OrchestrationRun,
} from "./orchestration";

const NOW = new Date("2026-10-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const adoptionRisk: OrchestrationAgent = {
  id: "adoption",
  name: "Adoption Risk CTA",
  conflictsWith: ["red-review"],
  cooldownDays: 14,
  maxAttempts: null,
  eligibleLifecycles: [],
};

const account: OrchestrationAccount = { id: "acc1", name: "Meridian", status: "active", lifecycle: "Adoption" };

const run = (overrides: Partial<OrchestrationRun>): OrchestrationRun => ({
  agentId: "adoption",
  agentName: "Adoption Risk CTA",
  status: "active",
  completedAt: null,
  ...overrides,
});

describe("checkAgentConflict", () => {
  it("blocks a duplicate active run of the same agent", () => {
    expect(checkAgentConflict(adoptionRisk, [run({})])).toMatchObject({ code: "duplicate" });
  });

  it("blocks when a conflicting agent is active, naming it", () => {
    const block = checkAgentConflict(adoptionRisk, [run({ agentId: "red-review", agentName: "Red Account Review" })]);
    expect(block).toMatchObject({ code: "conflict" });
    expect(block?.reason).toContain("Red Account Review");
  });

  it("ignores completed runs and non-conflicting agents", () => {
    expect(checkAgentConflict(adoptionRisk, [run({ status: "completed", completedAt: daysAgo(40) })])).toBeNull();
    expect(checkAgentConflict(adoptionRisk, [run({ agentId: "renewal", agentName: "Renewal CTA" })])).toBeNull();
  });
});

describe("checkAgentCooldown", () => {
  it("blocks within the cooldown window and reports days remaining", () => {
    const block = checkAgentCooldown(adoptionRisk, [run({ status: "completed", completedAt: daysAgo(4) })], NOW);
    expect(block).toMatchObject({ code: "cooldown" });
    expect(block?.reason).toContain("10 more days");
  });

  it("allows once the cooldown has elapsed", () => {
    expect(checkAgentCooldown(adoptionRisk, [run({ status: "completed", completedAt: daysAgo(15) })], NOW)).toBeNull();
  });

  it("does not apply to other agents or stopped runs", () => {
    expect(checkAgentCooldown(adoptionRisk, [run({ agentId: "other", status: "completed", completedAt: daysAgo(1) })], NOW)).toBeNull();
    expect(checkAgentCooldown(adoptionRisk, [run({ status: "stopped", completedAt: daysAgo(1) })], NOW)).toBeNull();
  });

  it("is disabled with a zero-day cooldown", () => {
    expect(checkAgentCooldown({ ...adoptionRisk, cooldownDays: 0 }, [run({ status: "completed", completedAt: daysAgo(0) })], NOW)).toBeNull();
  });
});

describe("checkAgentEligibility", () => {
  it("blocks churned accounts", () => {
    expect(checkAgentEligibility(adoptionRisk, { ...account, status: "churned" }, [])).toMatchObject({ code: "ineligible_status" });
  });

  it("enforces lifecycle restrictions", () => {
    const agent = { ...adoptionRisk, eligibleLifecycles: ["Onboarding"] };
    expect(checkAgentEligibility(agent, account, [])).toMatchObject({ code: "ineligible_lifecycle" });
    expect(checkAgentEligibility(agent, { ...account, lifecycle: "Onboarding" }, [])).toBeNull();
  });

  it("enforces maximum attempts across all historic runs", () => {
    const agent = { ...adoptionRisk, maxAttempts: 2 };
    const history = [run({ status: "completed", completedAt: daysAgo(100) }), run({ status: "stopped", completedAt: daysAgo(60) })];
    expect(checkAgentEligibility(agent, account, history)).toMatchObject({ code: "max_attempts" });
    expect(checkAgentEligibility(agent, account, history.slice(0, 1))).toBeNull();
  });
});

describe("evaluateLaunch / planLaunch", () => {
  it("returns the highest-priority block", () => {
    const runs = [run({})];
    expect(evaluateLaunch(adoptionRisk, { ...account, status: "churned" }, runs, NOW)?.code).toBe("ineligible_status");
    expect(evaluateLaunch(adoptionRisk, account, runs, NOW)?.code).toBe("duplicate");
  });

  it("splits accounts into eligible and skipped with reasons", () => {
    const accounts: OrchestrationAccount[] = [
      account,
      { ...account, id: "acc2", name: "Arclight" },
      { ...account, id: "acc3", name: "Northwind" },
    ];
    const runsByAccount = new Map<string, OrchestrationRun[]>([
      ["acc2", [run({})]],
      ["acc3", [run({ status: "completed", completedAt: daysAgo(2) })]],
    ]);
    const plan = planLaunch(adoptionRisk, accounts, runsByAccount, NOW);
    expect(plan.eligible.map((a) => a.id)).toEqual(["acc1"]);
    expect(plan.skipped.map((s) => [s.account.id, s.block.code])).toEqual([
      ["acc2", "duplicate"],
      ["acc3", "cooldown"],
    ]);
  });
});
