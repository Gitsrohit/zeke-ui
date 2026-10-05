import { z } from "zod";
import { HEALTH_SOURCE_KEYS } from "@/config/health";
import { toAccountFacts } from "@/features/accounts/domain/facts";
import { listAccountRows } from "@/features/accounts/repositories/account.repository";
import { getAIProvider } from "@/features/ai";
import { calculateAgentLift, calculateRunLift } from "@/features/agents/domain/analytics";
import { countSteps, validateStepTree } from "@/features/agents/domain/steps";
import { AGENT_CATEGORIES, AGENT_TRIGGER_TYPES } from "@/features/agents/domain/types";
import { agentStepsSchema } from "@/features/agents/schemas";
import {
  findAgent,
  findRun,
  getVersionStepCounts,
  getVersionSteps,
  insertAgent,
  insertAgentVersion,
  listAgents,
  listExecutions,
  listRuns,
  listRunSteps,
  replaceConflicts,
  updateAgent,
} from "@/features/agents/repositories/agent.repository";
import { findAudience } from "@/features/audiences/repositories/audience.repository";
import { recordAudit } from "@/features/audit/services/audit.service";
import { getCurrentSourceScores } from "@/features/health/repositories/health.repository";
import { db } from "@/lib/db/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";

export async function getAgentLibrary(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const agents = await listAgents(db, ctx.organizationId);
  const [counts, runs] = await Promise.all([getVersionStepCounts(db, agents.map((a) => a.currentVersionId).filter((v): v is string => Boolean(v))), listRuns(db, ctx.organizationId)]);
  return agents.map((a) => {
    const agentRuns = runs.filter((r) => r.agentId === a.id);
    const completed = agentRuns.filter((r) => r.status === "completed").length;
    return {
      ...a,
      stepCount: a.currentVersionId ? (counts.get(a.currentVersionId) ?? 0) : 0,
      totalRuns: agentRuns.length,
      activeRuns: agentRuns.filter((r) => r.status === "active").length,
      completionRate: agentRuns.length ? Math.round((completed / agentRuns.length) * 100) : null,
    };
  });
}

export type AgentLibraryItem = Awaited<ReturnType<typeof getAgentLibrary>>[number];

export async function getAgentForBuilder(ctx: ServiceContext, agentId: string) {
  assertPermission(ctx, "accounts.read");
  if (!z.string().uuid().safeParse(agentId).success) throw new NotFoundError("Agent");
  const agent = await findAgent(db, ctx.organizationId, agentId);
  if (!agent) throw new NotFoundError("Agent");
  const steps = agent.currentVersionId ? await getVersionSteps(db, agent.currentVersionId) : [];
  return { agent, steps };
}

export const saveAgentSchema = z.object({
  name: z.string().trim().min(2, "Name the agent").max(100),
  description: z.string().trim().max(500).default(""),
  category: z.enum(AGENT_CATEGORIES),
  status: z.enum(["active", "draft"]),
  triggerType: z.enum(AGENT_TRIGGER_TYPES),
  triggerLabel: z.string().trim().min(2).max(160),
  targetMetric: z.enum(HEALTH_SOURCE_KEYS),
  audienceId: z.string().uuid().nullable(),
  cooldownDays: z.coerce.number().int().min(0).max(365),
  maxAttempts: z.coerce.number().int().min(1).max(50).nullable(),
  eligibleLifecycles: z.array(z.string()).max(10),
  conflictsWith: z.array(z.string().uuid()).max(50),
  steps: agentStepsSchema,
});
export type SaveAgentInput = z.input<typeof saveAgentSchema>;

function slugify(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Creates an agent or saves a new immutable version of an existing one. Running runs keep the version they started on. */
export async function saveAgent(ctx: ServiceContext, input: unknown, agentId?: string): Promise<{ id: string; version: string }> {
  assertPermission(ctx, "agents.manage");
  const values = parseInput(saveAgentSchema, input);
  const errors = validateStepTree(values.steps);
  if (errors.length) throw new ValidationError(errors[0], { fieldErrors: { steps: errors } });
  if (values.audienceId && !(await findAudience(db, ctx.organizationId, values.audienceId))) throw new ValidationError("That audience no longer exists.");
  const existing = agentId ? await findAgent(db, ctx.organizationId, agentId) : null;
  if (agentId && !existing) throw new NotFoundError("Agent");
  const others = await listAgents(db, ctx.organizationId);
  const validConflicts = values.conflictsWith.filter((id) => id !== agentId && others.some((a) => a.id === id));
  const { conflictsWith: _conflicts, steps, ...meta } = values;

  return db.transaction(async (tx) => {
    const id = existing ? existing.id : await insertAgent(tx, ctx.organizationId, { ...meta, key: slugify(values.name), createdById: ctx.userId });
    const versionId = await insertAgentVersion(tx, ctx.organizationId, id, steps, ctx.userId);
    await updateAgent(tx, ctx.organizationId, id, { ...meta, currentVersionId: versionId });
    await replaceConflicts(tx, id, validConflicts);
    await recordAudit(tx, ctx, {
      action: existing ? "agent.updated" : "agent.created",
      entityType: "agent",
      entityId: id,
      summary: `${existing ? "Saved new version of" : "Created"} ${values.name} — ${countSteps(steps)} steps, cooldown ${values.cooldownDays}d${validConflicts.length ? `, conflicts with ${validConflicts.length}` : ""}`,
      before: existing ? { name: existing.name, cooldownDays: existing.cooldownDays, conflictsWith: existing.conflictsWith } : undefined,
      after: { ...meta, conflictsWith: validConflicts },
    });
    return { id, version: versionId };
  });
}

export async function archiveAgent(ctx: ServiceContext, agentId: string): Promise<void> {
  assertPermission(ctx, "agents.manage");
  const agent = await findAgent(db, ctx.organizationId, agentId);
  if (!agent) throw new NotFoundError("Agent");
  await db.transaction(async (tx) => {
    await updateAgent(tx, ctx.organizationId, agentId, { status: "archived" });
    await recordAudit(tx, ctx, { action: "agent.archived", entityType: "agent", entityId: agentId, summary: `Archived ${agent.name}` });
  });
}

export async function generateWorkflowWithAI(ctx: ServiceContext, prompt: string) {
  assertPermission(ctx, "agents.manage");
  rateLimit(`ai:${ctx.userId}`, 30, 60_000);
  const text = z.string().trim().min(3, "Describe the sequence you want").max(800).parse(prompt);
  return getAIProvider().generateAgentWorkflow(text);
}

/* ------------------------------ Analytics ------------------------------ */

export async function getAgentAnalytics(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const [agents, runs] = await Promise.all([listAgents(db, ctx.organizationId), listRuns(db, ctx.organizationId)]);
  const accountIds = [...new Set(runs.map((r) => r.accountId))];
  const [rows, sources] = await Promise.all([listAccountRows(db, { organizationId: ctx.organizationId, segmentScope: [] }, { ids: accountIds }), getCurrentSourceScores(db, ctx.organizationId, accountIds)]);
  const scoreNow = new Map(rows.map((r) => [r.id, r.score ?? 0]));

  const details = runs.map((r) => {
    const metricNow = sources.get(r.accountId)?.[r.targetMetric] ?? r.metricAtLaunch;
    const score = scoreNow.get(r.accountId) ?? r.scoreAtLaunch;
    const input = { status: r.status, metricAtLaunch: r.metricAtLaunch, scoreAtLaunch: r.scoreAtLaunch, metricNow, scoreNow: score };
    return { run: r, ...input, ...calculateRunLift(input) };
  });

  const perAgent = agents.map((a) => {
    const agentDetails = details.filter((d) => d.run.agentId === a.id);
    return {
      agent: { id: a.id, name: a.name, category: a.category, targetMetric: a.targetMetric, status: a.status },
      summary: calculateAgentLift(agentDetails),
      runs: agentDetails.map((d) => ({
        id: d.run.id,
        accountId: d.run.accountId,
        accountName: d.run.accountName,
        status: d.run.status,
        outcome: d.run.outcome,
        startedAt: d.run.startedAt.toISOString(),
        completedAt: d.run.completedAt?.toISOString() ?? null,
        metricAtLaunch: d.metricAtLaunch,
        metricNow: d.metricNow,
        metricLift: d.metricLift,
        scoreAtLaunch: d.scoreAtLaunch,
        scoreNow: d.scoreNow,
        scoreLift: d.scoreLift,
      })),
    };
  });

  return {
    overall: { ...calculateAgentLift(details), accountsAffected: accountIds.length },
    perAgent,
  };
}

export async function getRunDetail(ctx: ServiceContext, runId: string) {
  assertPermission(ctx, "accounts.read");
  if (!z.string().uuid().safeParse(runId).success) throw new NotFoundError("Agent run");
  const run = await findRun(db, ctx.organizationId, runId);
  if (!run) throw new NotFoundError("Agent run");
  // Respect segment scope: the run's account must be visible to the viewer.
  const [account] = await listAccountRows(db, ctx, { ids: [run.accountId] });
  if (!account) throw new NotFoundError("Agent run");
  const [steps, executions, sources] = await Promise.all([listRunSteps(db, runId), listExecutions(db, runId), getCurrentSourceScores(db, ctx.organizationId, [run.accountId])]);
  const facts = toAccountFacts(account);
  const metricNow = sources.get(run.accountId)?.[run.targetMetric] ?? run.metricAtLaunch;
  return {
    run: { ...run, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null },
    account: { id: account.id, name: account.name, score: facts.healthScore, band: facts.band },
    metricNow,
    scoreNow: facts.healthScore,
    steps: steps.map((s) => ({ ...s, dueAt: s.dueAt?.toISOString() ?? null, startedAt: s.startedAt?.toISOString() ?? null, completedAt: s.completedAt?.toISOString() ?? null })),
    executions: executions.map((e) => ({ ...e, executedAt: e.executedAt.toISOString() })),
  };
}
