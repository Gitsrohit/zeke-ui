import { describe, expect, it } from "vitest";
import { flattenConditions } from "@/features/audiences/domain/evaluate";
import { audienceFilterSchema } from "@/features/audiences/schemas";
import type { AccountFacts } from "@/features/audiences/domain/types";
import { parseAgentText, parseAudienceText, RuleBasedAIProvider } from "./rule-based";

const owners = [{ id: "11111111-1111-4111-8111-111111111111", name: "Maya Chen" }];
const conds = (text: string) => flattenConditions(parseAudienceText(text, { owners }).filter).map(({ field, operator, value }) => ({ field, operator, value }));

describe("parseAudienceText", () => {
  it("parses the canonical example into structured, valid filters", () => {
    const result = parseAudienceText("Show me Enterprise accounts in Adoption with health score below 60 that haven't had a meeting in 30 days.", { owners });
    expect(audienceFilterSchema.safeParse(result.filter).success).toBe(true);
    expect(conds("Show me Enterprise accounts in Adoption with health score below 60 that haven't had a meeting in 30 days.")).toEqual([
      { field: "lifecycle", operator: "equals", value: "Adoption" },
      { field: "segment", operator: "equals", value: "Enterprise" },
      { field: "healthScore", operator: "lessThan", value: 60 },
      { field: "lastMeetingDays", operator: "greaterThan", value: 30 },
    ]);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("understands renewals, ARR, owners, NPS and multi-value enums", () => {
    expect(conds("SMB accounts renewing in the next 90 days")).toEqual([
      { field: "segment", operator: "equals", value: "SMB" },
      { field: "renewalInDays", operator: "lessThan", value: 90 },
    ]);
    expect(conds("at risk or critical accounts with ARR above $50k owned by Maya")).toEqual([
      { field: "band", operator: "in", value: ["atRisk", "critical"] },
      { field: "arr", operator: "greaterThan", value: 50000 },
      { field: "owner", operator: "equals", value: owners[0].id },
    ]);
    expect(conds("detractors with more than 3 open tickets")).toEqual([
      { field: "openTickets", operator: "greaterThan", value: 3 },
      { field: "nps", operator: "lessThan", value: 0 },
    ]);
  });

  it("returns no filter and zero confidence for unrelated text", () => {
    const result = parseAudienceText("hello there", { owners });
    expect(result.filter.groups).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });
});

describe("parseAgentText", () => {
  it("builds ordered steps with a conditional branch", () => {
    const { steps } = parseAgentText("Send an email, wait 3 days, then create a task for the CSM if they haven't logged in");
    expect(steps.map((s) => s.type)).toEqual(["email", "wait", "condition"]);
    const condition = steps[2];
    if (condition.type !== "condition") throw new Error("expected condition");
    expect(condition.branches.yes.map((s) => s.type)).toEqual(["task"]);
    expect(steps[1].config).toEqual({ duration: 3, unit: "days" });
  });

  it("maps escalation to an API step", () => {
    const { steps } = parseAgentText("Send a re-engagement email, wait 7 days, then call the escalation API");
    expect(steps.map((s) => s.type)).toEqual(["email", "wait", "api"]);
  });
});

describe("RuleBasedAIProvider.answerQuestion", () => {
  const facts = (o: Partial<AccountFacts>): AccountFacts => ({
    id: "a", name: "Acme", lifecycle: "Adoption", segment: "SMB", band: "stable", healthScore: 70, predictiveRisk: 65, ownerId: null, ownerName: null,
    lastMeetingDays: 5, lastLoginDays: 1, openTickets: 0, nps: 10, renewalInDays: 200, arr: 20000, weakestSource: "telemetry", ...o,
  });
  const provider = new RuleBasedAIProvider();

  it("lists at-risk accounts and suggests navigation only", async () => {
    const answer = await provider.answerQuestion("Which accounts are at risk?", {
      accounts: [facts({ id: "1", name: "Low Co", band: "critical", healthScore: 30 }), facts({ id: "2" })],
      owners: [],
      userName: "Maya",
    });
    expect(answer.accounts.map((a) => a.id)).toEqual(["1"]);
    expect(answer.suggestedAction?.href).toBe("/outcomes");
  });

  it("explains a named account", async () => {
    const answer = await provider.answerQuestion("Why is Low Co's score so low?", { accounts: [facts({ id: "1", name: "Low Co", band: "critical", healthScore: 30 })], owners: [], userName: "Maya" });
    expect(answer.answer).toContain("Low Co scores 30");
    expect(answer.suggestedAction?.href).toContain("/score-dashboard?account=1");
  });
});
