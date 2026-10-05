import { and, asc, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import type { HealthSourceKey } from "@/config/health";
import type { DbExecutor } from "@/lib/db/client";
import {
  accounts,
  agentConflicts,
  agentExecutions,
  agentRuns,
  agentRunSteps,
  agents,
  agentSteps,
  agentVersions,
  audiences,
  users,
} from "@/lib/db/schema";
import type {
  AgentRunOutcome,
  AgentRunStatus,
  AgentStepConfig,
  AgentStepNode,
  AgentStepType,
  AgentTriggerType,
  RunStepStatus,
} from "@/features/agents/domain/types";

export interface AgentRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "draft" | "archived";
  triggerType: AgentTriggerType;
  triggerLabel: string;
  targetMetric: HealthSourceKey;
  audienceId: string | null;
  audienceName: string | null;
  currentVersionId: string | null;
  cooldownDays: number;
  maxAttempts: number | null;
  eligibleLifecycles: string[];
  conflictsWith: string[];
  updatedAt: Date;
}

const agentColumns = {
  id: agents.id,
  key: agents.key,
  name: agents.name,
  description: agents.description,
  category: agents.category,
  status: agents.status,
  triggerType: agents.triggerType,
  triggerLabel: agents.triggerLabel,
  targetMetric: agents.targetMetric,
  audienceId: agents.audienceId,
  audienceName: audiences.name,
  currentVersionId: agents.currentVersionId,
  cooldownDays: agents.cooldownDays,
  maxAttempts: agents.maxAttempts,
  eligibleLifecycles: agents.eligibleLifecycles,
  updatedAt: agents.updatedAt,
};

async function conflictMap(executor: DbExecutor, agentIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (agentIds.length === 0) return map;
  const rows = await executor
    .select()
    .from(agentConflicts)
    .where(or(inArray(agentConflicts.agentId, agentIds), inArray(agentConflicts.conflictsWithAgentId, agentIds)));
  const add = (a: string, b: string) => {
    const set = map.get(a) ?? new Set<string>();
    set.add(b);
    map.set(a, set);
  };
  // Conflicts are symmetric: either direction blocks enrolment.
  for (const r of rows) {
    add(r.agentId, r.conflictsWithAgentId);
    add(r.conflictsWithAgentId, r.agentId);
  }
  return map;
}

export async function listAgents(executor: DbExecutor, organizationId: string, options: { includeArchived?: boolean } = {}): Promise<AgentRecord[]> {
  const rows = await executor
    .select(agentColumns)
    .from(agents)
    .leftJoin(audiences, eq(agents.audienceId, audiences.id))
    .where(and(eq(agents.organizationId, organizationId), options.includeArchived ? undefined : sql`${agents.status} <> 'archived'`))
    .orderBy(asc(agents.createdAt), asc(agents.name));
  const conflicts = await conflictMap(executor, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, conflictsWith: [...(conflicts.get(r.id) ?? [])] }));
}

export async function findAgent(executor: DbExecutor, organizationId: string, agentId: string): Promise<AgentRecord | null> {
  const [row] = await executor
    .select(agentColumns)
    .from(agents)
    .leftJoin(audiences, eq(agents.audienceId, audiences.id))
    .where(and(eq(agents.organizationId, organizationId), eq(agents.id, agentId)))
    .limit(1);
  if (!row) return null;
  const conflicts = await conflictMap(executor, [row.id]);
  return { ...row, conflictsWith: [...(conflicts.get(row.id) ?? [])] };
}

export async function findAgentIdByKey(executor: DbExecutor, organizationId: string, key: string): Promise<string | null> {
  const [row] = await executor
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.organizationId, organizationId), eq(agents.key, key)))
    .limit(1);
  return row?.id ?? null;
}

interface StepRow {
  id: string;
  parentStepId: string | null;
  branch: "yes" | "no" | null;
  position: number;
  type: AgentStepType;
  config: AgentStepConfig;
}

function buildTree(rows: StepRow[]): AgentStepNode[] {
  const byParent = new Map<string, StepRow[]>();
  for (const r of rows) {
    const key = r.parentStepId ? `${r.parentStepId}:${r.branch}` : "root";
    const list = byParent.get(key) ?? [];
    list.push(r);
    byParent.set(key, list);
  }
  const toNode = (r: StepRow): AgentStepNode => {
    if (r.type === "condition") {
      const children = (b: "yes" | "no") => (byParent.get(`${r.id}:${b}`) ?? []).sort((a, z) => a.position - z.position).map(toNode);
      return { id: r.id, type: "condition", config: r.config as AgentStepNode["config"], branches: { yes: children("yes"), no: children("no") } } as AgentStepNode;
    }
    return { id: r.id, type: r.type, config: r.config } as AgentStepNode;
  };
  return (byParent.get("root") ?? []).sort((a, z) => a.position - z.position).map(toNode);
}

export async function getVersionSteps(executor: DbExecutor, versionId: string): Promise<AgentStepNode[]> {
  const rows = await executor
    .select({
      id: agentSteps.id,
      parentStepId: agentSteps.parentStepId,
      branch: agentSteps.branch,
      position: agentSteps.position,
      type: agentSteps.type,
      config: agentSteps.config,
    })
    .from(agentSteps)
    .where(eq(agentSteps.agentVersionId, versionId));
  return buildTree(rows);
}

export async function getVersionStepCounts(executor: DbExecutor, versionIds: string[]): Promise<Map<string, number>> {
  if (versionIds.length === 0) return new Map();
  const rows = await executor
    .select({ versionId: agentSteps.agentVersionId, total: sql<number>`count(*)::int` })
    .from(agentSteps)
    .where(inArray(agentSteps.agentVersionId, versionIds))
    .groupBy(agentSteps.agentVersionId);
  return new Map(rows.map((r) => [r.versionId, r.total]));
}

export async function getBranchSteps(executor: DbExecutor, parentStepId: string, branch: "yes" | "no"): Promise<StepRow[]> {
  return executor
    .select({
      id: agentSteps.id,
      parentStepId: agentSteps.parentStepId,
      branch: agentSteps.branch,
      position: agentSteps.position,
      type: agentSteps.type,
      config: agentSteps.config,
    })
    .from(agentSteps)
    .where(and(eq(agentSteps.parentStepId, parentStepId), eq(agentSteps.branch, branch)))
    .orderBy(asc(agentSteps.position));
}

export interface AgentWriteValues {
  name: string;
  description: string;
  category: string;
  status: "active" | "draft" | "archived";
  triggerType: AgentTriggerType;
  triggerLabel: string;
  targetMetric: HealthSourceKey;
  audienceId: string | null;
  cooldownDays: number;
  maxAttempts: number | null;
  eligibleLifecycles: string[];
}

export async function insertAgent(
  executor: DbExecutor,
  organizationId: string,
  values: AgentWriteValues & { key: string; createdById: string | null },
): Promise<string> {
  const [row] = await executor.insert(agents).values({ ...values, organizationId }).returning({ id: agents.id });
  return row.id;
}

export async function updateAgent(executor: DbExecutor, organizationId: string, agentId: string, values: Partial<AgentWriteValues> & { currentVersionId?: string }) {
  await executor
    .update(agents)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(agents.organizationId, organizationId), eq(agents.id, agentId)));
}

export async function replaceConflicts(executor: DbExecutor, agentId: string, conflictIds: string[]): Promise<void> {
  await executor
    .delete(agentConflicts)
    .where(or(eq(agentConflicts.agentId, agentId), eq(agentConflicts.conflictsWithAgentId, agentId)));
  const unique = [...new Set(conflictIds.filter((id) => id !== agentId))];
  if (unique.length) {
    await executor.insert(agentConflicts).values(unique.map((id) => ({ agentId, conflictsWithAgentId: id })));
  }
}

/** Persists a new immutable version of an agent's workflow and returns its id. */
export async function insertAgentVersion(
  executor: DbExecutor,
  organizationId: string,
  agentId: string,
  steps: AgentStepNode[],
  createdById: string | null,
): Promise<string> {
  const [latest] = await executor
    .select({ version: agentVersions.version })
    .from(agentVersions)
    .where(eq(agentVersions.agentId, agentId))
    .orderBy(desc(agentVersions.version))
    .limit(1);
  const [version] = await executor
    .insert(agentVersions)
    .values({ organizationId, agentId, version: (latest?.version ?? 0) + 1, createdById })
    .returning({ id: agentVersions.id });

  const rows: Array<typeof agentSteps.$inferInsert> = [];
  const walk = (nodes: AgentStepNode[], parentStepId: string | null, branch: "yes" | "no" | null) => {
    nodes.forEach((node, position) => {
      const id = crypto.randomUUID();
      rows.push({ id, agentVersionId: version.id, parentStepId, branch, position, type: node.type, config: node.config });
      if (node.type === "condition") {
        walk(node.branches.yes, id, "yes");
        walk(node.branches.no, id, "no");
      }
    });
  };
  walk(steps, null, null);
  if (rows.length) await executor.insert(agentSteps).values(rows);
  return version.id;
}

/* ------------------------------- Runs ------------------------------- */

export interface RunSummaryRow {
  id: string;
  agentId: string;
  agentName: string;
  accountId: string;
  accountName: string;
  ownerId: string | null;
  ownerName: string | null;
  status: AgentRunStatus;
  outcome: AgentRunOutcome | null;
  sourceLabel: string;
  targetMetric: HealthSourceKey;
  metricAtLaunch: number;
  scoreAtLaunch: number;
  startedAt: Date;
  completedAt: Date | null;
  stoppedReason: string | null;
}

const runColumns = {
  id: agentRuns.id,
  agentId: agentRuns.agentId,
  agentName: agents.name,
  accountId: agentRuns.accountId,
  accountName: accounts.name,
  ownerId: agentRuns.ownerId,
  ownerName: users.name,
  status: agentRuns.status,
  outcome: agentRuns.outcome,
  sourceLabel: agentRuns.sourceLabel,
  targetMetric: agentRuns.targetMetric,
  metricAtLaunch: agentRuns.metricAtLaunch,
  scoreAtLaunch: agentRuns.scoreAtLaunch,
  startedAt: agentRuns.startedAt,
  completedAt: agentRuns.completedAt,
  stoppedReason: agentRuns.stoppedReason,
};

function runQuery(executor: DbExecutor) {
  return executor
    .select(runColumns)
    .from(agentRuns)
    .innerJoin(agents, eq(agentRuns.agentId, agents.id))
    .innerJoin(accounts, eq(agentRuns.accountId, accounts.id))
    .leftJoin(users, eq(agentRuns.ownerId, users.id));
}

export async function listRuns(
  executor: DbExecutor,
  organizationId: string,
  filters: { accountIds?: readonly string[]; agentId?: string; status?: AgentRunStatus; limit?: number } = {},
): Promise<RunSummaryRow[]> {
  if (filters.accountIds && filters.accountIds.length === 0) return [];
  const q = runQuery(executor)
    .where(
      and(
        eq(agentRuns.organizationId, organizationId),
        filters.accountIds ? inArray(agentRuns.accountId, [...filters.accountIds]) : undefined,
        filters.agentId ? eq(agentRuns.agentId, filters.agentId) : undefined,
        filters.status ? eq(agentRuns.status, filters.status) : undefined,
      ),
    )
    .orderBy(desc(agentRuns.startedAt));
  return filters.limit ? q.limit(filters.limit) : q;
}

export async function findRun(executor: DbExecutor, organizationId: string, runId: string): Promise<RunSummaryRow | null> {
  const [row] = await runQuery(executor)
    .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.id, runId)))
    .limit(1);
  return row ?? null;
}

export async function insertRun(executor: DbExecutor, values: typeof agentRuns.$inferInsert): Promise<string> {
  const [row] = await executor.insert(agentRuns).values(values).returning({ id: agentRuns.id });
  return row.id;
}

export async function updateRun(executor: DbExecutor, runId: string, values: Partial<typeof agentRuns.$inferInsert>) {
  await executor.update(agentRuns).set(values).where(eq(agentRuns.id, runId));
}

export interface RunStepRow {
  id: string;
  runId: string;
  agentStepId: string | null;
  position: number;
  type: AgentStepType;
  config: AgentStepConfig;
  status: RunStepStatus;
  branchTaken: "yes" | "no" | null;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  completedByName: string | null;
}

export async function listRunSteps(executor: DbExecutor, runId: string): Promise<RunStepRow[]> {
  return executor
    .select({
      id: agentRunSteps.id,
      runId: agentRunSteps.runId,
      agentStepId: agentRunSteps.agentStepId,
      position: agentRunSteps.position,
      type: agentRunSteps.type,
      config: agentRunSteps.config,
      status: agentRunSteps.status,
      branchTaken: agentRunSteps.branchTaken,
      dueAt: agentRunSteps.dueAt,
      startedAt: agentRunSteps.startedAt,
      completedAt: agentRunSteps.completedAt,
      completedByName: users.name,
    })
    .from(agentRunSteps)
    .leftJoin(users, eq(agentRunSteps.completedById, users.id))
    .where(eq(agentRunSteps.runId, runId))
    .orderBy(asc(agentRunSteps.position));
}

export async function insertRunSteps(executor: DbExecutor, values: Array<typeof agentRunSteps.$inferInsert>) {
  if (values.length) await executor.insert(agentRunSteps).values(values);
}

export async function updateRunStep(executor: DbExecutor, stepId: string, values: Partial<typeof agentRunSteps.$inferInsert>) {
  await executor.update(agentRunSteps).set(values).where(eq(agentRunSteps.id, stepId));
}

/** Opens a gap of `count` positions after `afterPosition` so branch steps can be spliced in. */
export async function shiftRunSteps(executor: DbExecutor, runId: string, afterPosition: number, count: number) {
  await executor
    .update(agentRunSteps)
    .set({ position: sql`${agentRunSteps.position} + ${count}` })
    .where(and(eq(agentRunSteps.runId, runId), sql`${agentRunSteps.position} > ${afterPosition}`));
}

export async function skipPendingSteps(executor: DbExecutor, runId: string) {
  await executor
    .update(agentRunSteps)
    .set({ status: "skipped" })
    .where(and(eq(agentRunSteps.runId, runId), inArray(agentRunSteps.status, ["pending", "active", "waiting"])));
}

export async function listDueWaitSteps(executor: DbExecutor, now: Date, organizationId?: string) {
  return executor
    .select({ id: agentRunSteps.id, runId: agentRunSteps.runId, organizationId: agentRunSteps.organizationId })
    .from(agentRunSteps)
    .where(
      and(
        eq(agentRunSteps.status, "waiting"),
        lte(agentRunSteps.dueAt, now),
        organizationId ? eq(agentRunSteps.organizationId, organizationId) : undefined,
      ),
    )
    .limit(500);
}

export async function listWaitingSteps(executor: DbExecutor, organizationId: string, runIds: readonly string[]) {
  if (runIds.length === 0) return [];
  return executor
    .select({ id: agentRunSteps.id, runId: agentRunSteps.runId, config: agentRunSteps.config, dueAt: agentRunSteps.dueAt })
    .from(agentRunSteps)
    .where(and(eq(agentRunSteps.organizationId, organizationId), eq(agentRunSteps.status, "waiting"), inArray(agentRunSteps.runId, [...runIds])));
}

export async function insertExecution(executor: DbExecutor, values: typeof agentExecutions.$inferInsert) {
  await executor.insert(agentExecutions).values(values);
}

export async function listExecutions(executor: DbExecutor, runId: string) {
  return executor
    .select({
      id: agentExecutions.id,
      runStepId: agentExecutions.runStepId,
      action: agentExecutions.action,
      status: agentExecutions.status,
      detail: agentExecutions.detail,
      executedAt: agentExecutions.executedAt,
    })
    .from(agentExecutions)
    .where(eq(agentExecutions.runId, runId))
    .orderBy(asc(agentExecutions.executedAt));
}
