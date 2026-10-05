import { getEmailTemplate } from "@/config/email-templates";
import { getHealthSource } from "@/config/health";
import { toAccountFacts } from "@/features/accounts/domain/facts";
import { findAccountRow, listAccountRows, touchAccountActivity } from "@/features/accounts/repositories/account.repository";
import { classifyOutcome } from "@/features/agents/domain/analytics";
import { planLaunch, type OrchestrationRun } from "@/features/agents/domain/orchestration";
import { describeStepNode, evaluateAutoCondition, waitDurationMs } from "@/features/agents/domain/steps";
import type {
  AgentStepConfigMap,
  ApprovalStepConfig,
  ConditionStepConfig,
  EmailStepConfig,
  TaskStepConfig,
  WaitStepConfig,
} from "@/features/agents/domain/types";
import {
  findAgent,
  findRun,
  getBranchSteps,
  getVersionSteps,
  insertExecution,
  insertRun,
  insertRunSteps,
  listDueWaitSteps,
  listRuns,
  listRunSteps,
  shiftRunSteps,
  skipPendingSteps,
  updateRun,
  updateRunStep,
  type RunStepRow,
} from "@/features/agents/repositories/agent.repository";
import { recordAudit } from "@/features/audit/services/audit.service";
import { getCurrentSourceScores } from "@/features/health/repositories/health.repository";
import { isIntegrationConnected } from "@/features/integrations/repositories/integration.repository";
import { notifyUsers } from "@/features/notifications/services/notification.service";
import { cancelOpenItemsForRun, insertWorkItem } from "@/features/work/repositories/work.repository";
import { db, type DbExecutor } from "@/lib/db/client";
import { timelineEvents } from "@/lib/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { addDays } from "@/lib/utils/dates";
import { pluralize } from "@/lib/utils/format";

export interface LaunchInput {
  agentId: string;
  accountIds: readonly string[];
  audienceId?: string | null;
  sourceLabel: string;
}

export interface LaunchResult {
  launched: Array<{ accountId: string; accountName: string; runId: string }>;
  skipped: Array<{ accountId: string; accountName: string; reason: string; code: string }>;
}

const MAX_LAUNCH_BATCH = 500;

async function loadOrchestrationRuns(executor: DbExecutor, organizationId: string, accountIds: readonly string[]) {
  const runs = await listRuns(executor, organizationId, { accountIds });
  const map = new Map<string, OrchestrationRun[]>();
  for (const r of runs) {
    const list = map.get(r.accountId) ?? [];
    list.push({ agentId: r.agentId, agentName: r.agentName, status: r.status, completedAt: r.completedAt });
    map.set(r.accountId, list);
  }
  return map;
}

/** Dry-run of orchestration rules — used by launch confirmation dialogs. */
export async function previewLaunch(ctx: ServiceContext, agentId: string, accountIds: readonly string[]) {
  assertPermission(ctx, "agents.launch");
  const agent = await findAgent(db, ctx.organizationId, agentId);
  if (!agent) throw new NotFoundError("Agent");
  const rows = await listAccountRows(db, ctx, { ids: accountIds.slice(0, MAX_LAUNCH_BATCH) });
  const runsByAccount = await loadOrchestrationRuns(db, ctx.organizationId, rows.map((r) => r.id));
  const plan = planLaunch(agent, rows.map((r) => ({ ...r, lifecycle: r.lifecycle })), runsByAccount);
  return {
    agent: { id: agent.id, name: agent.name },
    eligibleCount: plan.eligible.length,
    skipped: plan.skipped.map((s) => ({ accountId: s.account.id, accountName: s.account.name, reason: s.block.reason, code: s.block.code })),
  };
}

/**
 * Launches an agent for a set of accounts. Runs through the orchestration engine:
 * eligibility → conflict/duplicate → cooldown. Enrolled accounts get a run whose
 * automatic steps execute immediately; the first human step lands in My Work.
 */
export async function launchAgent(ctx: ServiceContext, input: LaunchInput, options: { now?: Date } = {}): Promise<LaunchResult> {
  assertPermission(ctx, "agents.launch");
  const now = options.now ?? new Date();
  if (input.accountIds.length === 0) throw new ValidationError("Choose at least one account to launch for.");
  if (input.accountIds.length > MAX_LAUNCH_BATCH) throw new ValidationError(`You can launch for at most ${MAX_LAUNCH_BATCH} accounts at once.`);

  const agent = await findAgent(db, ctx.organizationId, input.agentId);
  if (!agent) throw new NotFoundError("Agent");
  if (agent.status !== "active") throw new ConflictError(`"${agent.name}" is ${agent.status} and cannot be launched.`);
  if (!agent.currentVersionId) throw new ConflictError(`"${agent.name}" has no saved workflow yet.`);
  const versionId = agent.currentVersionId;

  return db.transaction(async (tx) => {
    // Segment scope is applied here: accounts outside the viewer's access are silently excluded.
    const rows = await listAccountRows(tx, ctx, { ids: input.accountIds });
    const runsByAccount = await loadOrchestrationRuns(tx, ctx.organizationId, rows.map((r) => r.id));
    const plan = planLaunch(agent, rows, runsByAccount, now);
    const steps = await getVersionSteps(tx, versionId);
    const sources = await getCurrentSourceScores(tx, ctx.organizationId, plan.eligible.map((a) => a.id));

    const result: LaunchResult = {
      launched: [],
      skipped: plan.skipped.map((s) => ({ accountId: s.account.id, accountName: s.account.name, reason: s.block.reason, code: s.block.code })),
    };

    for (const account of plan.eligible) {
      const runId = await insertRun(tx, {
        organizationId: ctx.organizationId,
        agentId: agent.id,
        agentVersionId: versionId,
        accountId: account.id,
        ownerId: account.ownerId,
        audienceId: input.audienceId ?? null,
        sourceLabel: input.sourceLabel,
        status: "active",
        targetMetric: agent.targetMetric,
        metricAtLaunch: sources.get(account.id)?.[agent.targetMetric] ?? 0,
        scoreAtLaunch: account.score ?? 0,
        launchedById: ctx.userId,
        startedAt: now,
      });
      await insertRunSteps(
        tx,
        steps.map((s, position) => ({
          organizationId: ctx.organizationId,
          runId,
          agentStepId: s.id,
          position,
          type: s.type,
          config: s.config,
          status: "pending" as const,
        })),
      );
      await tx.insert(timelineEvents).values({
        organizationId: ctx.organizationId,
        accountId: account.id,
        actorId: ctx.userId,
        kind: "agent_launched",
        title: `${agent.name} launched`,
        description: `Source: ${input.sourceLabel}`,
        entityType: "agent_run",
        entityId: runId,
        occurredAt: now,
      });
      await advanceRun(tx, ctx, runId, now);
      result.launched.push({ accountId: account.id, accountName: account.name, runId });
    }

    await recordAudit(tx, ctx, {
      action: "agent.launched",
      entityType: "agent",
      entityId: agent.id,
      summary: `${agent.name} → ${pluralize(result.launched.length, "account")}${result.skipped.length ? `, ${result.skipped.length} skipped by orchestration rules` : ""} (${input.sourceLabel})`,
      after: { launched: result.launched.map((l) => l.accountId), skipped: result.skipped },
    });

    const ownerIds = new Set(plan.eligible.map((a) => a.ownerId).filter((id): id is string => Boolean(id) && id !== ctx.userId));
    await notifyUsers(
      tx,
      [...ownerIds].map((userId) => ({
        organizationId: ctx.organizationId,
        userId,
        type: "agent.launched",
        title: `${agent.name} launched on your accounts`,
        body: `${ctx.userName} enrolled ${pluralize(plan.eligible.filter((a) => a.ownerId === userId).length, "of your accounts", "of your accounts")}.`,
        href: "/my-work",
      })),
    );
    return result;
  });
}

async function nextOpenStep(executor: DbExecutor, runId: string): Promise<RunStepRow | undefined> {
  const steps = await listRunSteps(executor, runId);
  return steps.find((s) => s.status === "pending" || s.status === "active" || s.status === "waiting");
}

async function completeRun(executor: DbExecutor, ctx: ServiceContext, runId: string, now: Date) {
  const run = await findRun(executor, ctx.organizationId, runId);
  if (!run) return;
  const sources = await getCurrentSourceScores(executor, ctx.organizationId, [run.accountId]);
  const metricNow = sources.get(run.accountId)?.[run.targetMetric] ?? run.metricAtLaunch;
  await updateRun(executor, runId, { status: "completed", completedAt: now, outcome: classifyOutcome(metricNow - run.metricAtLaunch) });
  await executor.insert(timelineEvents).values({
    organizationId: ctx.organizationId,
    accountId: run.accountId,
    actorId: ctx.userId,
    kind: "agent_completed",
    title: `${run.agentName} completed`,
    entityType: "agent_run",
    entityId: runId,
    occurredAt: now,
  });
  await recordAudit(executor, ctx, {
    action: "agent.run_completed",
    entityType: "agent_run",
    entityId: runId,
    summary: `${run.agentName} completed for ${run.accountName}`,
  });
}

async function createStepWorkItem(executor: DbExecutor, ctx: ServiceContext, runId: string, step: RunStepRow, now: Date) {
  const run = await findRun(executor, ctx.organizationId, runId);
  if (!run) throw new NotFoundError("Agent run");
  const base = {
    organizationId: ctx.organizationId,
    accountId: run.accountId,
    ownerId: run.ownerId,
    source: "agent" as const,
    agentRunId: runId,
    agentRunStepId: step.id,
    createdById: ctx.userId,
  };
  if (step.type === "task") {
    const c = step.config as TaskStepConfig;
    await insertWorkItem(executor, { ...base, type: "task", title: c.title, description: `${run.agentName} · owner role: ${c.ownerRole}`, priority: c.priority, dueAt: addDays(now, c.dueInDays) });
  } else if (step.type === "email") {
    const c = step.config as EmailStepConfig;
    const tpl = getEmailTemplate(c.templateKey);
    await insertWorkItem(executor, { ...base, type: "approval", title: `Approve email: "${tpl?.name ?? c.templateKey}"`, description: tpl ? `Subject: ${tpl.subject}` : null, priority: "high", dueAt: addDays(now, 1) });
  } else if (step.type === "approval") {
    const c = step.config as ApprovalStepConfig;
    await insertWorkItem(executor, { ...base, type: "approval", title: c.title, description: `${run.agentName} is waiting for approval from: ${c.approverRole}`, priority: "high", dueAt: addDays(now, 2) });
  } else if (step.type === "condition") {
    const c = step.config as ConditionStepConfig;
    await insertWorkItem(executor, { ...base, type: "decision", title: `Decision needed: ${c.label}`, description: `Your answer branches the rest of ${run.agentName}.`, priority: "high", dueAt: addDays(now, 1) });
  }
}

async function spliceConditionBranch(executor: DbExecutor, ctx: ServiceContext, runId: string, step: RunStepRow, branch: "yes" | "no") {
  const branchSteps = step.agentStepId ? await getBranchSteps(executor, step.agentStepId, branch) : [];
  if (branchSteps.length) {
    await shiftRunSteps(executor, runId, step.position, branchSteps.length);
    await insertRunSteps(
      executor,
      branchSteps.map((b, i) => ({
        organizationId: ctx.organizationId,
        runId,
        agentStepId: b.id,
        position: step.position + 1 + i,
        type: b.type,
        config: b.config,
        status: "pending" as const,
      })),
    );
  }
}

/**
 * Executes automatic steps in order until the run reaches a step that needs a
 * person (task, approval, manual decision), a wait, or the end of the workflow.
 */
export async function advanceRun(executor: DbExecutor, ctx: ServiceContext, runId: string, now: Date = new Date()): Promise<void> {
  for (let guard = 0; guard < 100; guard++) {
    const step = await nextOpenStep(executor, runId);
    if (!step) {
      await completeRun(executor, ctx, runId, now);
      return;
    }
    // Already waiting on a person or a timer.
    if (step.status === "active" || step.status === "waiting") return;

    switch (step.type) {
      case "email": {
        const c = step.config as EmailStepConfig;
        if (c.requiresApproval) {
          await updateRunStep(executor, step.id, { status: "active", startedAt: now });
          await createStepWorkItem(executor, ctx, runId, step, now);
          return;
        }
        await executeEmail(executor, ctx, runId, step, now);
        break;
      }
      case "api": {
        const c = step.config as AgentStepConfigMap["api"];
        await insertExecution(executor, {
          organizationId: ctx.organizationId,
          runId,
          runStepId: step.id,
          action: "api.request",
          status: "logged",
          detail: { method: c.method, endpoint: c.endpoint, note: "Outbound webhooks are not configured for this workspace — the request was logged, not sent." },
          executedAt: now,
        });
        await updateRunStep(executor, step.id, { status: "completed", startedAt: now, completedAt: now });
        break;
      }
      case "wait": {
        const c = step.config as WaitStepConfig;
        await updateRunStep(executor, step.id, { status: "waiting", startedAt: now, dueAt: new Date(now.getTime() + waitDurationMs(c)) });
        return;
      }
      case "condition": {
        const c = step.config as ConditionStepConfig;
        if (c.mode === "auto") {
          const row = await findRunAccountFacts(executor, ctx, runId);
          const branch = row ? evaluateAutoCondition(c, row) : null;
          if (branch) {
            await updateRunStep(executor, step.id, { status: "completed", branchTaken: branch, startedAt: now, completedAt: now });
            await spliceConditionBranch(executor, ctx, runId, step, branch);
            break;
          }
        }
        await updateRunStep(executor, step.id, { status: "active", startedAt: now });
        await createStepWorkItem(executor, ctx, runId, step, now);
        return;
      }
      case "task":
      case "approval": {
        await updateRunStep(executor, step.id, { status: "active", startedAt: now });
        await createStepWorkItem(executor, ctx, runId, step, now);
        return;
      }
      case "stop": {
        await updateRunStep(executor, step.id, { status: "completed", startedAt: now, completedAt: now });
        await skipPendingSteps(executor, runId);
        await completeRun(executor, ctx, runId, now);
        return;
      }
    }
  }
  throw new Error(`Agent run ${runId} exceeded the step execution limit`);
}

async function findRunAccountFacts(executor: DbExecutor, ctx: ServiceContext, runId: string) {
  const run = await findRun(executor, ctx.organizationId, runId);
  if (!run) return null;
  const row = await findAccountRow(executor, { organizationId: ctx.organizationId, segmentScope: [] }, run.accountId);
  return row ? toAccountFacts(row) : null;
}

async function executeEmail(executor: DbExecutor, ctx: ServiceContext, runId: string, step: RunStepRow, now: Date) {
  const c = step.config as EmailStepConfig;
  const tpl = getEmailTemplate(c.templateKey);
  const outlook = await isIntegrationConnected(executor, ctx.organizationId, "outlook");
  await insertExecution(executor, {
    organizationId: ctx.organizationId,
    runId,
    runStepId: step.id,
    action: "email.send",
    status: outlook ? "queued" : "logged",
    detail: {
      template: tpl?.name ?? c.templateKey,
      subject: tpl?.subject ?? "",
      note: outlook ? "Queued for delivery via Outlook 365." : "Outlook 365 is not connected — the email was logged on the timeline, not delivered.",
    },
    executedAt: now,
  });
  await updateRunStep(executor, step.id, { status: "completed", startedAt: now, completedAt: now });
  const run = await findRun(executor, ctx.organizationId, runId);
  if (run) await touchAccountActivity(executor, ctx.organizationId, run.accountId, now);
}

export type StepResolution = { kind: "complete" } | { kind: "branch"; branch: "yes" | "no" } | { kind: "approve" } | { kind: "reject"; reason?: string };

/**
 * Resolves the active human step of a run (called when its work item is
 * completed) and continues execution.
 */
export async function resolveRunStep(
  executor: DbExecutor,
  ctx: ServiceContext,
  runId: string,
  runStepId: string,
  resolution: StepResolution,
  now: Date = new Date(),
): Promise<void> {
  const run = await findRun(executor, ctx.organizationId, runId);
  if (!run) throw new NotFoundError("Agent run");
  if (run.status !== "active") throw new ConflictError("This agent run is no longer active.");
  const steps = await listRunSteps(executor, runId);
  const step = steps.find((s) => s.id === runStepId);
  if (!step || step.status !== "active") throw new ConflictError("This step has already been resolved.");

  if (resolution.kind === "reject") {
    await updateRunStep(executor, step.id, { status: "skipped", completedAt: now, completedById: ctx.userId });
    await stopRunInternal(executor, ctx, runId, resolution.reason ?? `${describeStepNode(step)} was rejected`, now);
    return;
  }

  if (step.type === "condition") {
    if (resolution.kind !== "branch") throw new ValidationError("Choose Yes or No to resolve this decision.");
    await updateRunStep(executor, step.id, { status: "completed", branchTaken: resolution.branch, completedAt: now, completedById: ctx.userId });
    await spliceConditionBranch(executor, ctx, runId, step, resolution.branch);
  } else {
    if (step.type === "email") await executeEmail(executor, ctx, runId, step, now);
    await updateRunStep(executor, step.id, { status: "completed", completedAt: now, completedById: ctx.userId });
  }
  await advanceRun(executor, ctx, runId, now);
}

async function stopRunInternal(executor: DbExecutor, ctx: ServiceContext, runId: string, reason: string, now: Date) {
  const run = await findRun(executor, ctx.organizationId, runId);
  if (!run) throw new NotFoundError("Agent run");
  await skipPendingSteps(executor, runId);
  await cancelOpenItemsForRun(executor, runId, `Run stopped: ${reason}`);
  await updateRun(executor, runId, { status: "stopped", outcome: "stopped", completedAt: now, stoppedReason: reason });
  await recordAudit(executor, ctx, {
    action: "agent.run_stopped",
    entityType: "agent_run",
    entityId: runId,
    summary: `${run.agentName} stopped for ${run.accountName} — ${reason}`,
  });
}

export async function stopRun(ctx: ServiceContext, runId: string, reason: string): Promise<void> {
  assertPermission(ctx, "agents.manage");
  const run = await findRun(db, ctx.organizationId, runId);
  if (!run) throw new NotFoundError("Agent run");
  if (run.status !== "active") throw new ConflictError("This run is not active.");
  await db.transaction((tx) => stopRunInternal(tx, ctx, runId, reason.trim() || "Stopped manually", new Date()));
}

/** Manager override: end a wait early and continue the run now. */
export async function skipWait(ctx: ServiceContext, runId: string): Promise<void> {
  assertPermission(ctx, "agents.manage");
  const now = new Date();
  await db.transaction(async (tx) => {
    const run = await findRun(tx, ctx.organizationId, runId);
    if (!run) throw new NotFoundError("Agent run");
    const steps = await listRunSteps(tx, runId);
    const waiting = steps.find((s) => s.status === "waiting");
    if (!waiting) throw new ConflictError("This run is not waiting.");
    await updateRunStep(tx, waiting.id, { status: "completed", completedAt: now, completedById: ctx.userId });
    await recordAudit(tx, ctx, {
      action: "agent.wait_skipped",
      entityType: "agent_run",
      entityId: runId,
      summary: `Skipped "${describeStepNode(waiting)}" for ${run.accountName} (${run.agentName})`,
    });
    await advanceRun(tx, ctx, runId, now);
  });
}

/** Scheduler entry point: resumes every run whose wait has elapsed. */
export async function processDueWaits(ctxFor: (organizationId: string) => ServiceContext, now: Date = new Date(), organizationId?: string): Promise<number> {
  const due = await listDueWaitSteps(db, now, organizationId);
  let resumed = 0;
  for (const step of due) {
    const ctx = ctxFor(step.organizationId);
    await db.transaction(async (tx) => {
      await updateRunStep(tx, step.id, { status: "completed", completedAt: now });
      await advanceRun(tx, ctx, step.runId, now);
    });
    resumed++;
  }
  return resumed;
}

export function describeTargetMetric(key: Parameters<typeof getHealthSource>[0]): string {
  return getHealthSource(key).name;
}
