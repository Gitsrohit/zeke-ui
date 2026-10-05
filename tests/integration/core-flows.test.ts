import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAccount, getAccountDetail, getAccountsPage, listAccountFacts } from "@/features/accounts/services/account.service";
import { launchAgent, processDueWaits, skipWait, stopRun } from "@/features/agents/services/agent-engine.service";
import { getAgentAnalytics, getAgentLibrary, getRunDetail, saveAgent } from "@/features/agents/services/agent.service";
import { previewAudience, resolveAudienceMembers, saveAudience } from "@/features/audiences/services/audience.service";
import { getAuditLog } from "@/features/audit/services/audit-query.service";
import { connectIntegration, disconnectIntegration, getIntegrations, syncIntegration } from "@/features/integrations/services/integration.service";
import { getScorecardMatrix, updateScorecard } from "@/features/scorecards/services/scorecard.service";
import { globalSearch } from "@/features/search/services/search.service";
import { inviteUser, updateMember } from "@/features/users/services/user.service";
import { completeWorkItem, getWorkQueue, reassignWorkItem, snoozeWorkItem } from "@/features/work/services/work.service";
import { db } from "@/lib/db/client";
import { agentRuns, agentRunSteps, agents, workItems } from "@/lib/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { systemContext } from "@/lib/server/context";
import { contextFor, prepareDatabase } from "./helpers";

beforeEach(async () => {
  await prepareDatabase();
});

async function agentId(organizationId: string, key: string) {
  const [row] = await db.select({ id: agents.id }).from(agents).where(and(eq(agents.organizationId, organizationId), eq(agents.key, key)));
  return row.id;
}

describe("tenant isolation", () => {
  it("never returns another organisation's accounts, runs or search results", async () => {
    const zeke = await contextFor("maya.chen@zeke.dev");
    const northstar = await contextFor("elena.petrova@northstar.dev");
    const zekeAccounts = await listAccountFacts(zeke);
    const northAccounts = await listAccountFacts(northstar);
    expect(zekeAccounts).toHaveLength(36);
    expect(northAccounts).toHaveLength(4);
    expect(zekeAccounts.some((a) => northAccounts.some((n) => n.id === a.id))).toBe(false);

    await expect(getAccountDetail(northstar, zekeAccounts[0].id)).rejects.toBeInstanceOf(NotFoundError);
    const search = await globalSearch(northstar, "Meridian");
    expect(search.accounts).toHaveLength(0);

    const [zekeRun] = await db.select({ id: agentRuns.id }).from(agentRuns).where(eq(agentRuns.organizationId, zeke.organizationId)).limit(1);
    await expect(getRunDetail(northstar, zekeRun.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("applies segment access scope for restricted members", async () => {
    const diego = await contextFor("diego.ruiz@zeke.dev"); // SMB + Mid-Market only
    const page = await getAccountsPage(diego, { pageSize: 100 });
    expect(page.total).toBe(24);
    expect(page.items.every((a) => a.segment !== "Enterprise")).toBe(true);
  });
});

describe("permissions", () => {
  it("blocks viewers from writes and CSMs from admin actions", async () => {
    const viewer = await contextFor("riley.park@zeke.dev");
    const csm = await contextFor("sam.oconnor@zeke.dev");
    await expect(createAccount(viewer, { name: "X Corp", lifecycleStageId: crypto.randomUUID(), segmentId: crypto.randomUUID(), arr: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(connectIntegration(csm, "gong")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getAuditLog(csm, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(inviteUser(csm, { name: "Eve", email: "eve@x.dev", role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("prevents admins from granting the owner role", async () => {
    const admin = await contextFor("maya.chen@zeke.dev");
    await expect(inviteUser(admin, { name: "Eve", email: "eve@x.dev", role: "owner" })).rejects.toBeInstanceOf(ForbiddenError);
    const ok = await inviteUser(admin, { name: "Eve", email: "eve@x.dev", role: "csm", segments: ["SMB"] });
    expect(ok.inviteToken.length).toBeGreaterThan(20);
  });

  it("does not let users change their own role", async () => {
    const owner = await contextFor("alex.rivera@zeke.dev");
    const members = await (await import("@/features/users/services/user.service")).getMembers(owner);
    const self = members.find((m) => m.email === "alex.rivera@zeke.dev")!;
    await expect(updateMember(owner, self.membershipId, { role: "viewer", segments: [] })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("create account", () => {
  it("validates input, creates the account, scores it and audits it", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const page = await getAccountsPage(maya, { pageSize: 5 });
    const detail = await getAccountDetail(maya, page.items[0].id);
    await expect(createAccount(maya, { name: "A", lifecycleStageId: detail.profile.lifecycleStageId, segmentId: detail.profile.segmentId, arr: 10 })).rejects.toBeInstanceOf(ValidationError);
    const created = await createAccount(maya, { name: "Zephyr Robotics", domain: "zephyr.io", lifecycleStageId: detail.profile.lifecycleStageId, segmentId: detail.profile.segmentId, arr: 64000, renewalDate: "2027-03-01" });
    const fresh = await getAccountDetail(maya, created.id);
    expect(fresh.account.name).toBe("Zephyr Robotics");
    expect(fresh.account.band).toBe("critical"); // no source data yet
    const audit = await getAuditLog(maya, { q: "Zephyr" });
    expect(audit.rows[0].action).toBe("account.created");
  });
});

describe("audiences", () => {
  it("saves live audiences and static snapshots with different membership semantics", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const filter = { combinator: "or" as const, groups: [{ id: "g", combinator: "and" as const, conditions: [{ id: "c", field: "healthScore" as const, operator: "lessThan" as const, value: 60 }], groups: [] }] };
    const preview = await previewAudience(maya, filter);
    expect(preview.count).toBeGreaterThan(0);

    const live = await saveAudience(maya, { name: "Below 60 (live)", type: "dynamic", filter });
    const snap = await saveAudience(maya, { name: "Below 60 (snapshot)", type: "static", filter });
    expect(live.memberCount).toBe(preview.count);
    expect(snap.memberCount).toBe(preview.count);

    // Raise the bar: a scorecard change moves scores; the snapshot stays frozen, the live audience re-evaluates.
    const matrix = await getScorecardMatrix(maya);
    const sc = matrix.find((m) => m.lifecycle === "Adoption" && m.segment === "Enterprise")!;
    await updateScorecard(maya, sc.id, { weights: { telemetry: 0, survey: 0, meetings: 0, tickets: 0, renewal: 0, crm: 0, hygiene: 100 }, thresholds: sc.thresholds, effectiveFrom: "2026-01-01" });
    const liveAfter = await resolveAudienceMembers(maya, live.id);
    const snapAfter = await resolveAudienceMembers(maya, snap.id);
    expect(snapAfter.members).toHaveLength(snap.memberCount);
    expect(liveAfter.members.every((m) => m.healthScore < 60)).toBe(true);
  });

  it("rejects malformed filters", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    await expect(previewAudience(maya, { combinator: "or", groups: [{ id: "g", combinator: "and", conditions: [{ id: "c", field: "segment", operator: "lessThan", value: "SMB" }], groups: [] }] })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("scorecards", () => {
  it("rejects weights that do not total 100 and versions valid changes", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const matrix = await getScorecardMatrix(maya);
    const sc = matrix[0];
    await expect(updateScorecard(maya, sc.id, { weights: { ...sc.weights, telemetry: sc.weights.telemetry + 5 }, thresholds: sc.thresholds, effectiveFrom: "2026-10-01" })).rejects.toThrow(/total 100/);
    await expect(updateScorecard(maya, sc.id, { weights: sc.weights, thresholds: { thriving: 50, stable: 60, atRisk: 40 }, effectiveFrom: "2026-10-01" })).rejects.toBeInstanceOf(ValidationError);
    const result = await updateScorecard(maya, sc.id, { weights: sc.weights, thresholds: { thriving: 85, stable: 65, atRisk: 45 }, effectiveFrom: "2026-10-01", changeNote: "Stricter bands" });
    expect(result.version).toBe(2);
    const after = await getScorecardMatrix(maya);
    expect(after.find((m) => m.id === sc.id)!.thresholds).toEqual({ thriving: 85, stable: 65, atRisk: 45 });
  });
});

describe("agent launch, orchestration and execution", () => {
  it("enforces duplicate, conflict and cooldown rules server-side with clear reasons", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const accounts = await listAccountFacts(maya);
    const target = accounts.find((a) => a.lifecycle === "Growth")!;
    const adoption = await agentId(maya.organizationId, "adoption-risk");
    const red = await agentId(maya.organizationId, "red-account-review");

    // Clear any seeded runs for a clean slate on this account.
    await db.delete(agentRuns).where(eq(agentRuns.accountId, target.id));

    const first = await launchAgent(maya, { agentId: adoption, accountIds: [target.id], sourceLabel: "test" });
    expect(first.launched).toHaveLength(1);
    const duplicate = await launchAgent(maya, { agentId: adoption, accountIds: [target.id], sourceLabel: "test" });
    expect(duplicate.skipped[0]).toMatchObject({ code: "duplicate" });
    const conflict = await launchAgent(maya, { agentId: red, accountIds: [target.id], sourceLabel: "test" });
    expect(conflict.skipped[0]).toMatchObject({ code: "conflict" });
    expect(conflict.skipped[0].reason).toContain("Adoption Risk CTA");

    await stopRun(maya, first.launched[0].runId, "test stop");
    // Stopped runs don't trigger cooldown; completed ones do.
    await db.update(agentRuns).set({ status: "completed", completedAt: new Date() }).where(eq(agentRuns.id, first.launched[0].runId));
    const cooldown = await launchAgent(maya, { agentId: adoption, accountIds: [target.id], sourceLabel: "test" });
    expect(cooldown.skipped[0]).toMatchObject({ code: "cooldown" });
  });

  it("runs automatic steps, queues human steps, branches on decisions and completes", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const accounts = await listAccountFacts(maya);
    const target = accounts.find((a) => a.lifecycle === "Onboarding")!;
    await db.delete(agentRuns).where(eq(agentRuns.accountId, target.id));

    const saved = await saveAgent(maya, {
      name: "Test sequence",
      description: "",
      category: "Adoption",
      status: "active",
      triggerType: "manual",
      triggerLabel: "Manual",
      targetMetric: "telemetry",
      audienceId: null,
      cooldownDays: 0,
      maxAttempts: null,
      eligibleLifecycles: [],
      conflictsWith: [],
      steps: [
        { id: "a", type: "email", config: { templateKey: "welcome", requiresApproval: false } },
        { id: "b", type: "task", config: { title: "Call the champion", ownerRole: "CSM", dueInDays: 1, priority: "high" } },
        { id: "c", type: "wait", config: { duration: 2, unit: "days" } },
        { id: "d", type: "condition", config: { mode: "manual", label: "Did they respond?" }, branches: { yes: [{ id: "e", type: "task", config: { title: "Book QBR", ownerRole: "CSM", dueInDays: 3, priority: "medium" } }], no: [{ id: "f", type: "stop", config: { reason: "no response" } }] } },
      ],
    });

    const { launched } = await launchAgent(maya, { agentId: saved.id, accountIds: [target.id], sourceLabel: "test" });
    const runId = launched[0].runId;
    let detail = await getRunDetail(maya, runId);
    expect(detail.steps.map((s) => s.status)).toEqual(["completed", "active", "pending", "pending"]);
    expect(detail.executions[0].action).toBe("email.send");

    const owner = target.ownerId === maya.userId ? maya : { ...maya, permissions: ROLE_PERMISSIONS.admin };
    const [taskItem] = await db.select().from(workItems).where(and(eq(workItems.agentRunId, runId), eq(workItems.status, "open")));
    expect(taskItem.title).toBe("Call the champion");
    await completeWorkItem(owner, taskItem.id, { resolution: "complete" });

    detail = await getRunDetail(maya, runId);
    expect(detail.steps[2].status).toBe("waiting");

    await skipWait(maya, runId);
    const [decision] = await db.select().from(workItems).where(and(eq(workItems.agentRunId, runId), eq(workItems.status, "open")));
    expect(decision.type).toBe("decision");
    await expect(completeWorkItem(owner, decision.id, { resolution: "complete" })).rejects.toBeInstanceOf(ValidationError);
    await completeWorkItem(owner, decision.id, { resolution: "no" });

    detail = await getRunDetail(maya, runId);
    expect(detail.run.status).toBe("completed");
    expect(detail.steps.map((s) => s.type)).toEqual(["email", "task", "wait", "condition", "stop"]);
    expect(detail.steps[3].branchTaken).toBe("no");
  });

  it("resumes elapsed waits from the scheduler", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    await db.update(agentRunSteps).set({ dueAt: new Date(Date.now() - 1000) }).where(eq(agentRunSteps.status, "waiting"));
    const resumed = await processDueWaits((org) => systemContext(org, ROLE_PERMISSIONS.owner));
    expect(resumed).toBeGreaterThan(0);
    const waiting = await db.select().from(agentRunSteps).where(and(eq(agentRunSteps.status, "waiting"), eq(agentRunSteps.organizationId, maya.organizationId)));
    expect(waiting.every((w) => (w.dueAt?.getTime() ?? 0) > Date.now())).toBe(true);
  });

  it("reports analytics with live lift", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const analytics = await getAgentAnalytics(maya);
    expect(analytics.overall.totalRuns).toBeGreaterThan(30);
    expect(analytics.perAgent).toHaveLength(9);
    const library = await getAgentLibrary(maya);
    expect(library.every((a) => a.stepCount > 0)).toBe(true);
  });
});

describe("work queue", () => {
  it("completes, snoozes and reassigns with ownership rules", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    const sam = await contextFor("sam.oconnor@zeke.dev");
    const queue = await getWorkQueue(maya, { owner: "me" });
    const manual = queue.items.find((i) => i.source === "manual")!;
    await expect(completeWorkItem(sam, manual.id, {})).rejects.toBeInstanceOf(ForbiddenError);
    await snoozeWorkItem(maya, manual.id, { days: 2 });
    const after = await getWorkQueue(maya, { owner: "me" });
    expect(after.items.some((i) => i.id === manual.id)).toBe(false);
    const snoozed = await getWorkQueue(maya, { owner: "me", view: "snoozed" });
    expect(snoozed.items.some((i) => i.id === manual.id)).toBe(true);
    await reassignWorkItem(maya, manual.id, { ownerId: sam.userId! });
    await completeWorkItem(sam, manual.id, {});
    const done = await getWorkQueue(sam, { owner: "me", view: "completed" });
    expect(done.items.some((i) => i.id === manual.id)).toBe(true);
  });
});

describe("integrations", () => {
  it("connects, syncs and disconnects with audit entries", async () => {
    const maya = await contextFor("maya.chen@zeke.dev");
    await expect(syncIntegration(maya, "gong")).rejects.toThrow(/Connect/);
    await connectIntegration(maya, "gong");
    const sync = await syncIntegration(maya, "gong");
    expect(sync.status).toContain("Synced 36");
    await disconnectIntegration(maya, "gong");
    const list = await getIntegrations(maya);
    expect(list.find((i) => i.key === "gong")!.status).toBe("disconnected");
    const audit = await getAuditLog(maya, { entityType: "integration" });
    expect(audit.rows.slice(0, 3).map((r) => r.action)).toEqual(["integration.disconnected", "integration.synced", "integration.connected"]);
  });
});
