import { z } from "zod";
import { resolveRunStep, type StepResolution } from "@/features/agents/services/agent-engine.service";
import { recordAudit } from "@/features/audit/services/audit.service";
import { notifyUsers } from "@/features/notifications/services/notification.service";
import { listOrgUsers } from "@/features/users/repositories/user.repository";
import { countOpenWorkItems, findWorkItem, listWorkItems, updateWorkItem, type WorkItemRow } from "@/features/work/repositories/work.repository";
import { db } from "@/lib/db/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, can, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";
import { addDays } from "@/lib/utils/dates";

export const WORK_FILTERS = ["all", "today", "overdue", "high", "agent", "manual"] as const;
export type WorkFilter = (typeof WORK_FILTERS)[number];

export const workQuerySchema = z.object({
  view: z.enum(["open", "snoozed", "completed"]).default("open"),
  filter: z.enum(WORK_FILTERS).default("all"),
  owner: z.string().default("me"),
  accountId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
});
export type WorkQuery = z.infer<typeof workQuerySchema>;

export interface WorkItemView extends Omit<WorkItemRow, "dueAt" | "snoozedUntil" | "completedAt" | "createdAt"> {
  dueAt: string | null;
  snoozedUntil: string | null;
  completedAt: string | null;
  createdAt: string;
  overdue: boolean;
}

function serialize(row: WorkItemRow, now: Date): WorkItemView {
  return {
    ...row,
    dueAt: row.dueAt?.toISOString() ?? null,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    overdue: row.status !== "completed" && row.dueAt !== null && row.dueAt.getTime() < now.getTime(),
  };
}

export async function getWorkQueue(ctx: ServiceContext, input: unknown) {
  assertPermission(ctx, "accounts.read");
  const q = parseInput(workQuerySchema, input);
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const ownerId = q.owner === "me" ? (ctx.userId ?? undefined) : q.owner === "all" ? undefined : q.owner;
  let rows = await listWorkItems(db, ctx.organizationId, {
    view: q.view,
    ownerId,
    accountId: q.accountId,
    agentId: q.agentId,
    priority: q.filter === "high" ? "high" : undefined,
    dueBefore: q.filter === "today" ? endOfToday : q.filter === "overdue" ? now : undefined,
    now,
  });
  if (q.filter === "agent") rows = rows.filter((r) => r.source === "agent");
  if (q.filter === "manual") rows = rows.filter((r) => r.source !== "agent");
  const owners = await listOrgUsers(db, ctx.organizationId);
  const [mine, everyone] = await Promise.all([ctx.userId ? countOpenWorkItems(db, ctx.organizationId, now, ctx.userId) : 0, countOpenWorkItems(db, ctx.organizationId, now)]);
  return { items: rows.map((r) => serialize(r, now)), owners, counts: { mine, everyone }, query: q };
}

async function loadEditable(ctx: ServiceContext, id: string) {
  assertPermission(ctx, "work.manage");
  const item = await findWorkItem(db, ctx.organizationId, id);
  if (!item) throw new NotFoundError("Work item");
  // CSMs act on their own items; managers can act on anyone's.
  if (item.ownerId && item.ownerId !== ctx.userId && !can(ctx, "agents.manage")) {
    throw new ForbiddenError("This item belongs to someone else. Ask them or a manager to reassign it.");
  }
  return item;
}

export const completeSchema = z.object({
  resolution: z.enum(["complete", "approve", "reject", "yes", "no"]).default("complete"),
  note: z.string().trim().max(500).optional(),
});

export async function completeWorkItem(ctx: ServiceContext, id: string, input: unknown) {
  const item = await loadEditable(ctx, id);
  const { resolution, note } = parseInput(completeSchema, input);
  if (item.status === "completed" || item.status === "cancelled") throw new ConflictError("This item is already closed.");
  if (item.type === "decision" && resolution !== "yes" && resolution !== "no") throw new ValidationError("Answer Yes or No to resolve this decision.");
  if (item.type === "approval" && resolution !== "approve" && resolution !== "reject") throw new ValidationError("Approve or reject this item.");
  const now = new Date();
  const label = resolution === "yes" ? "Yes" : resolution === "no" ? "No" : resolution === "approve" ? "Approved" : resolution === "reject" ? "Rejected" : "Completed";

  await db.transaction(async (tx) => {
    await updateWorkItem(tx, ctx.organizationId, id, { status: "completed", completedAt: now, completedById: ctx.userId, resolution: note ? `${label} — ${note}` : label });
    if (item.agentRunId && item.agentRunStepId) {
      const step: StepResolution =
        resolution === "yes" || resolution === "no"
          ? { kind: "branch", branch: resolution }
          : resolution === "reject"
            ? { kind: "reject", reason: note ? `Rejected by ${ctx.userName}: ${note}` : `Rejected by ${ctx.userName}` }
            : resolution === "approve"
              ? { kind: "approve" }
              : { kind: "complete" };
      await resolveRunStep(tx, ctx, item.agentRunId, item.agentRunStepId, step, now);
    }
    await recordAudit(tx, ctx, {
      action: item.type === "approval" ? `work.${resolution === "reject" ? "rejected" : "approved"}` : item.type === "decision" ? "work.decided" : "work.completed",
      entityType: "work_item",
      entityId: id,
      summary: `${label}: "${item.title}"${item.accountName ? ` — ${item.accountName}` : ""}${item.agentName ? ` (${item.agentName})` : ""}`,
    });
  });
  return { label };
}

export const snoozeSchema = z.object({ days: z.coerce.number().int().min(1).max(30) });

export async function snoozeWorkItem(ctx: ServiceContext, id: string, input: unknown) {
  const item = await loadEditable(ctx, id);
  const { days } = parseInput(snoozeSchema, input);
  if (item.status !== "open" && item.status !== "snoozed") throw new ConflictError("Only open items can be snoozed.");
  const until = addDays(new Date(), days);
  await db.transaction(async (tx) => {
    await updateWorkItem(tx, ctx.organizationId, id, { status: "snoozed", snoozedUntil: until });
    await recordAudit(tx, ctx, { action: "work.snoozed", entityType: "work_item", entityId: id, summary: `Snoozed "${item.title}" for ${days} day${days === 1 ? "" : "s"}` });
  });
  return { until: until.toISOString() };
}

export const reassignSchema = z.object({ ownerId: z.string().uuid() });

export async function reassignWorkItem(ctx: ServiceContext, id: string, input: unknown) {
  const item = await loadEditable(ctx, id);
  const { ownerId } = parseInput(reassignSchema, input);
  const owners = await listOrgUsers(db, ctx.organizationId);
  const owner = owners.find((o) => o.id === ownerId);
  if (!owner) throw new ValidationError("Choose a teammate in this workspace.");
  if (ownerId === item.ownerId) return { ownerName: owner.name };
  await db.transaction(async (tx) => {
    await updateWorkItem(tx, ctx.organizationId, id, { ownerId, status: item.status === "snoozed" ? "open" : item.status, snoozedUntil: null });
    await recordAudit(tx, ctx, { action: "work.reassigned", entityType: "work_item", entityId: id, summary: `Reassigned "${item.title}" from ${item.ownerName ?? "unassigned"} to ${owner.name}`, before: { ownerId: item.ownerId }, after: { ownerId } });
    if (ownerId !== ctx.userId) {
      await notifyUsers(tx, [{ organizationId: ctx.organizationId, userId: ownerId, type: "work.assigned", title: `${ctx.userName} assigned you a task`, body: item.title, href: "/my-work" }]);
    }
  });
  return { ownerName: owner.name };
}

export async function getOpenWorkCount(ctx: ServiceContext): Promise<number> {
  if (!ctx.userId) return 0;
  return countOpenWorkItems(db, ctx.organizationId, new Date(), ctx.userId);
}
