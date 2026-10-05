import { and, asc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/client";
import { accounts, agentRuns, agents, healthScores, users, workItems } from "@/lib/db/schema";

export type WorkItemType = (typeof workItems.$inferSelect)["type"];
export type WorkItemStatus = (typeof workItems.$inferSelect)["status"];
export type WorkItemPriority = (typeof workItems.$inferSelect)["priority"];
export type WorkItemSource = (typeof workItems.$inferSelect)["source"];

export interface WorkItemRow {
  id: string;
  type: WorkItemType;
  title: string;
  description: string | null;
  priority: WorkItemPriority;
  status: WorkItemStatus;
  source: WorkItemSource;
  accountId: string | null;
  accountName: string | null;
  accountScore: number | null;
  accountBand: string | null;
  ownerId: string | null;
  ownerName: string | null;
  agentRunId: string | null;
  agentRunStepId: string | null;
  agentId: string | null;
  agentName: string | null;
  dueAt: Date | null;
  snoozedUntil: Date | null;
  completedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
}

const columns = {
  id: workItems.id,
  type: workItems.type,
  title: workItems.title,
  description: workItems.description,
  priority: workItems.priority,
  status: workItems.status,
  source: workItems.source,
  accountId: workItems.accountId,
  accountName: accounts.name,
  accountScore: healthScores.score,
  accountBand: healthScores.band,
  ownerId: workItems.ownerId,
  ownerName: users.name,
  agentRunId: workItems.agentRunId,
  agentRunStepId: workItems.agentRunStepId,
  agentId: agentRuns.agentId,
  agentName: agents.name,
  dueAt: workItems.dueAt,
  snoozedUntil: workItems.snoozedUntil,
  completedAt: workItems.completedAt,
  resolution: workItems.resolution,
  createdAt: workItems.createdAt,
};

function baseQuery(executor: DbExecutor) {
  return executor
    .select(columns)
    .from(workItems)
    .leftJoin(accounts, eq(workItems.accountId, accounts.id))
    .leftJoin(healthScores, eq(healthScores.accountId, workItems.accountId))
    .leftJoin(users, eq(workItems.ownerId, users.id))
    .leftJoin(agentRuns, eq(workItems.agentRunId, agentRuns.id))
    .leftJoin(agents, eq(agentRuns.agentId, agents.id));
}

export interface WorkQuery {
  /** open = open + snoozed items whose snooze has expired. */
  view: "open" | "snoozed" | "completed";
  ownerId?: string;
  accountId?: string;
  agentId?: string;
  priority?: WorkItemPriority;
  dueBefore?: Date;
  dueOnOrAfter?: Date;
  now: Date;
  limit?: number;
}

export async function listWorkItems(executor: DbExecutor, organizationId: string, query: WorkQuery): Promise<WorkItemRow[]> {
  const conditions: SQL[] = [eq(workItems.organizationId, organizationId)];
  if (query.view === "open") {
    const openish = or(
      eq(workItems.status, "open"),
      and(eq(workItems.status, "snoozed"), lt(workItems.snoozedUntil, query.now)),
    );
    if (openish) conditions.push(openish);
  } else if (query.view === "snoozed") {
    conditions.push(eq(workItems.status, "snoozed"), gte(workItems.snoozedUntil, query.now));
  } else {
    conditions.push(eq(workItems.status, "completed"));
  }
  if (query.ownerId) conditions.push(eq(workItems.ownerId, query.ownerId));
  if (query.accountId) conditions.push(eq(workItems.accountId, query.accountId));
  if (query.agentId) conditions.push(eq(agentRuns.agentId, query.agentId));
  if (query.priority) conditions.push(eq(workItems.priority, query.priority));
  if (query.dueBefore) conditions.push(lt(workItems.dueAt, query.dueBefore));
  if (query.dueOnOrAfter) conditions.push(gte(workItems.dueAt, query.dueOnOrAfter));

  const order =
    query.view === "completed"
      ? [sql`${workItems.completedAt} desc nulls last`]
      : [sql`case ${workItems.priority} when 'high' then 0 when 'medium' then 1 else 2 end`, sql`${workItems.dueAt} asc nulls last`, asc(workItems.createdAt)];

  return baseQuery(executor)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(query.limit ?? 200);
}

export async function findWorkItem(executor: DbExecutor, organizationId: string, id: string): Promise<WorkItemRow | null> {
  const [row] = await baseQuery(executor)
    .where(and(eq(workItems.organizationId, organizationId), eq(workItems.id, id)))
    .limit(1);
  return row ?? null;
}

export async function insertWorkItem(executor: DbExecutor, values: typeof workItems.$inferInsert): Promise<string> {
  const [row] = await executor.insert(workItems).values(values).returning({ id: workItems.id });
  return row.id;
}

export async function updateWorkItem(executor: DbExecutor, organizationId: string, id: string, values: Partial<typeof workItems.$inferInsert>) {
  await executor
    .update(workItems)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(workItems.organizationId, organizationId), eq(workItems.id, id)));
}

export async function cancelOpenItemsForRun(executor: DbExecutor, runId: string, resolution: string) {
  await executor
    .update(workItems)
    .set({ status: "cancelled", resolution, updatedAt: new Date() })
    .where(and(eq(workItems.agentRunId, runId), inArray(workItems.status, ["open", "snoozed"])));
}

export async function countOpenWorkItems(executor: DbExecutor, organizationId: string, now: Date, ownerId?: string): Promise<number> {
  const [{ total }] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(workItems)
    .where(
      and(
        eq(workItems.organizationId, organizationId),
        or(eq(workItems.status, "open"), and(eq(workItems.status, "snoozed"), lt(workItems.snoozedUntil, now))),
        ownerId ? eq(workItems.ownerId, ownerId) : undefined,
      ),
    );
  return total;
}
