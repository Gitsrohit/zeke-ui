import { beforeAll, describe, expect, it } from "vitest";
import { acceptInvitation, authenticateWithPassword, getInvitation, registerOrganization } from "@/features/auth/auth.service";
import { askAssistant } from "@/features/ai/services/assistant.service";
import { parseAudienceWithAI } from "@/features/audiences/services/audience.service";
import { getDashboardOverview, getRenewalForecast } from "@/features/dashboard/services/dashboard.service";
import { getScoreAccount, getScorePortfolio, parseScoreFilters } from "@/features/health/services/score-dashboard.service";
import { dismissRisk, getExpansionOverview, getRiskOverview } from "@/features/outcomes/services/outcome.service";
import { getWorkspaceSettings, updateWorkspaceSettings } from "@/features/settings/services/settings.service";
import { inviteUser } from "@/features/users/services/user.service";
import { ConflictError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { contextFor, prepareDatabase } from "./helpers";

beforeAll(async () => {
  await prepareDatabase();
});

describe("dashboard", () => {
  it("computes KPIs and distribution that add up", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const overview = await getDashboardOverview(maya);
    expect(overview.kpis.totalAccounts).toBe(36);
    expect(overview.distribution.reduce((s, d) => s + d.count, 0)).toBe(36);
    expect(overview.byLifecycle.map((l) => l.count)).toEqual([9, 9, 9, 9]);
    const forecast = await getRenewalForecast(maya);
    expect(forecast.weighted180).toBeLessThanOrEqual(forecast.arr180);
    expect(forecast.pipeline.every((p) => (p.renewalInDays ?? 999) <= 180)).toBe(true);
  });
});

describe("drive outcome", () => {
  it("groups risks by root cause with recommended agents and respects dismissals", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const before = await getRiskOverview(maya);
    expect(before.groups.length).toBeGreaterThan(0);
    const first = before.groups[0];
    expect(first.agent).not.toBeNull();
    expect(first.accounts[0].observedSignal).toMatch(/\/100/);
    const total = before.groups.reduce((s, g) => s + g.accounts.length, 0);

    await dismissRisk(maya, { accountId: first.accounts[0].id, days: 7, reason: "Known issue, exec call booked" });
    const after = await getRiskOverview(maya);
    expect(after.groups.reduce((s, g) => s + g.accounts.length, 0)).toBe(total - 1);
    expect(after.dismissedCount).toBe(1);

    const viewer = await contextFor("riley.park@zeke.dev");
    await expect(dismissRisk(viewer, { accountId: first.accounts[1]?.id ?? first.accounts[0].id })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists expansion opportunities with illustrative potential", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const expansion = await getExpansionOverview(maya);
    expect(expansion.groups).toHaveLength(3);
    expect(expansion.totalPotential).toBeGreaterThan(0);
  });
});

describe("advanced score dashboard", () => {
  it("aggregates the portfolio and explains one account", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const all = await getScorePortfolio(maya, parseScoreFilters({}));
    expect(all.items).toHaveLength(36);
    expect(all.months).toHaveLength(12);
    expect(all.sources).toHaveLength(7);
    const focus = all.focus[0];
    expect(all.metrics[focus]!.length).toBeGreaterThan(3);

    const enterprise = await getScorePortfolio(maya, parseScoreFilters({ segment: "Enterprise", band: "atRisk" }));
    expect(enterprise.items.every((i) => i.segment === "Enterprise" && i.band === "atRisk")).toBe(true);

    const target = all.items[0];
    const detail = await getScoreAccount(maya, parseScoreFilters({}), target.id);
    expect(detail?.account.score).toBe(target.score);
    const points = detail!.sources.reduce((s, x) => s + x.points, 0);
    expect(Math.round(points)).toBe(target.score);
    expect(detail!.sources[0].metrics[0].raw).toHaveLength(12);
  });

  it("ignores invalid filter params instead of failing", () => {
    expect(parseScoreFilters({ band: "nonsense" }).band).toBe("");
  });
});

describe("AI (rule-based provider)", () => {
  it("parses natural language into a validated filter with a live preview", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const result = await parseAudienceWithAI(maya, "Enterprise accounts in Adoption with health score below 60");
    expect(result.provider).toBe("rule-based");
    expect(result.filter.groups[0].conditions.map((c) => c.field)).toEqual(["lifecycle", "segment", "healthScore"]);
    expect(result.preview.accounts.every((a) => a.segment === "Enterprise" && a.healthScore < 60)).toBe(true);
  });

  it("answers questions from tenant-scoped data only", async () => {
    const elena = await contextFor("elena.petrova@northstar.dev");
    const answer = await askAssistant(elena, "Which accounts are at risk?");
    const ids = new Set((await (await import("@/features/accounts/services/account.service")).listAccountFacts(elena)).map((a) => a.id));
    expect(answer.accounts.every((a) => ids.has(a.id))).toBe(true);
  });
});

describe("auth flows", () => {
  it("authenticates, rejects bad passwords and creates isolated tenants on signup", async () => {
    await expect(authenticateWithPassword({ email: "maya.chen@zeke.dev", password: "wrong-password" })).rejects.toBeInstanceOf(UnauthorizedError);
    const ok = await authenticateWithPassword({ email: "MAYA.CHEN@zeke.dev", password: "zeke-demo-2026" });
    expect(ok.organizationId).toBeTruthy();

    const created = await registerOrganization({ name: "New Founder", email: "founder@newco.dev", organizationName: "NewCo", password: "correct-horse-42" });
    expect(created.organizationId).not.toBe(ok.organizationId);
    await expect(registerOrganization({ name: "Dup", email: "founder@newco.dev", organizationName: "Dup", password: "correct-horse-42" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("accepts an invitation exactly once", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const { inviteToken } = await inviteUser(maya, { name: "Jo Invite", email: "jo@zeke.dev", role: "viewer" });
    expect((await getInvitation(inviteToken))?.email).toBe("jo@zeke.dev");
    const principal = await acceptInvitation({ token: inviteToken, name: "Jo Invited", password: "a-strong-pass-1" });
    expect(principal.organizationId).toBe(maya.organizationId);
    expect(await getInvitation(inviteToken)).toBeNull();
    const login = await authenticateWithPassword({ email: "jo@zeke.dev", password: "a-strong-pass-1" });
    expect(login.userId).toBe(principal.userId);
  });
});

describe("settings", () => {
  it("updates workspace settings with permission checks", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    await updateWorkspaceSettings(maya, { recalculationSchedule: "daily", alertThreshold: 48 });
    expect(await getWorkspaceSettings(maya)).toEqual({ recalculationSchedule: "daily", alertThreshold: 48 });
    const csm = await contextFor("sam.oconnor@zeke.dev");
    await expect(updateWorkspaceSettings(csm, { recalculationSchedule: "weekly", alertThreshold: 10 })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
