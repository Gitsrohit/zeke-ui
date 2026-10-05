import { and, desc, eq } from "drizzle-orm";
import { accountFormSchema, noteSchema, manualTaskSchema } from "@/features/accounts/schemas";
import { z } from "zod";
import { DEFAULT_BAND_THRESHOLDS, HEALTH_BAND_KEYS } from "@/config/health";
import { toAccountFacts } from "@/features/accounts/domain/facts";
import {
  ACCOUNT_SORT_KEYS,
  findAccountRow,
  insertAccount,
  listAccountRows,
  listAccountsPage,
  listLifecycleStages,
  listSegments,
  touchAccountActivity,
  updateAccount,
  type AccountRow,
} from "@/features/accounts/repositories/account.repository";
import { listRuns } from "@/features/agents/repositories/agent.repository";
import { recordAudit } from "@/features/audit/services/audit.service";
import { calculateContributions } from "@/features/health/domain/score";
import { getCurrentSourceScores, getSnapshotHistory, listActiveScorecards, scorecardKey } from "@/features/health/repositories/health.repository";
import { recalculateHealthScores } from "@/features/health/services/health-calculation.service";
import { listOrgUsers } from "@/features/users/repositories/user.repository";
import { listWorkItems, insertWorkItem } from "@/features/work/repositories/work.repository";
import { db } from "@/lib/db/client";
import { accountContacts, activities, contacts, notes, opportunities, timelineEvents, users, workspaces } from "@/lib/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";
import { addDays, DAY_MS } from "@/lib/utils/dates";

export const accountPageQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  lifecycle: z.array(z.string()).optional(),
  segment: z.array(z.string()).optional(),
  band: z.array(z.enum(HEALTH_BAND_KEYS)).optional(),
  ownerId: z.array(z.string().uuid()).optional(),
  sort: z.enum(ACCOUNT_SORT_KEYS).default("score"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
export type AccountPageQueryInput = z.input<typeof accountPageQuerySchema>;

export interface AccountListItem {
  id: string;
  name: string;
  domain: string | null;
  lifecycle: string;
  segment: string;
  ownerId: string | null;
  ownerName: string | null;
  arr: number;
  score: number;
  band: (typeof HEALTH_BAND_KEYS)[number];
  trendDelta: number;
  predictiveRisk: number;
  renewalDate: string | null;
  renewalInDays: number | null;
  lastActivityAt: string | null;
}

export function toListItem(row: AccountRow, now: Date = new Date()): AccountListItem {
  const facts = toAccountFacts(row, now);
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    lifecycle: row.lifecycle,
    segment: row.segment,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    arr: row.arr,
    score: facts.healthScore,
    band: facts.band,
    trendDelta: row.trendDelta ?? 0,
    predictiveRisk: facts.predictiveRisk,
    renewalDate: row.renewalDate,
    renewalInDays: facts.renewalInDays,
    lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
  };
}

export async function getAccountsPage(ctx: ServiceContext, input: unknown) {
  assertPermission(ctx, "accounts.read");
  const query = parseInput(accountPageQuerySchema, input);
  const { rows, total } = await listAccountsPage(db, ctx, query);
  const now = new Date();
  return { items: rows.map((r) => toListItem(r, now)), total, page: query.page, pageSize: query.pageSize };
}

/** All accessible accounts as evaluable facts (scoped by tenant and segment access). */
export async function listAccountFacts(ctx: ServiceContext, options: { activeOnly?: boolean } = {}) {
  assertPermission(ctx, "accounts.read");
  const rows = await listAccountRows(db, ctx, options);
  const now = new Date();
  return rows.map((r) => toAccountFacts(r, now));
}

export async function getAccountFilterOptions(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const [stages, segs, owners] = await Promise.all([listLifecycleStages(db, ctx.organizationId), listSegments(db, ctx.organizationId), listOrgUsers(db, ctx.organizationId)]);
  return { lifecycles: stages, segments: segs, owners };
}

export async function getAccountDetail(ctx: ServiceContext, accountId: string) {
  assertPermission(ctx, "accounts.read");
  if (!z.string().uuid().safeParse(accountId).success) throw new NotFoundError("Account");
  const row = await findAccountRow(db, ctx, accountId);
  if (!row) throw new NotFoundError("Account");
  const now = new Date();
  const org = ctx.organizationId;

  const [sources, scorecards, history, contactRows, opportunityRows, noteRows, activityRows, timelineRows, runs, openWork, completedWork, peerRows] = await Promise.all([
    getCurrentSourceScores(db, org, [accountId]),
    listActiveScorecards(db, org),
    getSnapshotHistory(db, org, { accountIds: [accountId], since: new Date(now.getTime() - 400 * DAY_MS) }),
    db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        title: contacts.title,
        role: accountContacts.role,
        isChampion: accountContacts.isChampion,
        isPrimary: accountContacts.isPrimary,
        status: accountContacts.status,
        lastEngagedAt: accountContacts.lastEngagedAt,
      })
      .from(accountContacts)
      .innerJoin(contacts, eq(accountContacts.contactId, contacts.id))
      .where(and(eq(accountContacts.organizationId, org), eq(accountContacts.accountId, accountId)))
      .orderBy(desc(accountContacts.isPrimary), desc(accountContacts.isChampion)),
    db
      .select({ id: opportunities.id, name: opportunities.name, type: opportunities.type, stage: opportunities.stage, amount: opportunities.amount, closeDate: opportunities.closeDate, ownerName: users.name })
      .from(opportunities)
      .leftJoin(users, eq(opportunities.ownerId, users.id))
      .where(and(eq(opportunities.organizationId, org), eq(opportunities.accountId, accountId)))
      .orderBy(opportunities.closeDate),
    db
      .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt, authorName: users.name })
      .from(notes)
      .leftJoin(users, eq(notes.authorId, users.id))
      .where(and(eq(notes.organizationId, org), eq(notes.accountId, accountId)))
      .orderBy(desc(notes.createdAt)),
    db
      .select({ id: activities.id, type: activities.type, subject: activities.subject, body: activities.body, occurredAt: activities.occurredAt, userName: users.name })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(and(eq(activities.organizationId, org), eq(activities.accountId, accountId)))
      .orderBy(desc(activities.occurredAt))
      .limit(100),
    db
      .select({ id: timelineEvents.id, kind: timelineEvents.kind, title: timelineEvents.title, description: timelineEvents.description, occurredAt: timelineEvents.occurredAt, actorName: users.name, entityType: timelineEvents.entityType, entityId: timelineEvents.entityId })
      .from(timelineEvents)
      .leftJoin(users, eq(timelineEvents.actorId, users.id))
      .where(and(eq(timelineEvents.organizationId, org), eq(timelineEvents.accountId, accountId)))
      .orderBy(desc(timelineEvents.occurredAt))
      .limit(100),
    listRuns(db, org, { accountIds: [accountId] }),
    listWorkItems(db, org, { view: "open", accountId, now }),
    listWorkItems(db, org, { view: "completed", accountId, now, limit: 20 }),
    listAccountRows(db, { organizationId: org, segmentScope: [] }, {}),
  ]);

  const scorecard = scorecards.find((s) => scorecardKey(s.lifecycleStageId, s.segmentId) === scorecardKey(row.lifecycleStageId, row.segmentId));
  const accountSources = sources.get(accountId) ?? {};
  const contributions = calculateContributions(accountSources, scorecard?.weights ?? {});
  const peers = peerRows.filter((p) => p.lifecycleStageId === row.lifecycleStageId && p.segmentId === row.segmentId);
  const peerAverage = peers.length ? Math.round(peers.reduce((s, p) => s + (p.score ?? 0), 0) / peers.length) : null;

  return {
    account: toListItem(row, now),
    facts: toAccountFacts(row, now),
    profile: {
      industry: row.industry,
      status: row.status,
      nps: row.nps,
      openTickets: row.openTickets,
      licensedSeats: row.licensedSeats,
      lastMeetingAt: row.lastMeetingAt?.toISOString() ?? null,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      keyRolesDocumented: row.keyRolesDocumented,
      keyRolesTotal: row.keyRolesTotal,
      lifecycleStageId: row.lifecycleStageId,
      segmentId: row.segmentId,
      createdAt: row.createdAt.toISOString(),
    },
    scorecard: scorecard ? { id: scorecard.scorecardId, name: scorecard.name, thresholds: scorecard.thresholds, weights: scorecard.weights } : { id: null, name: "No scorecard", thresholds: DEFAULT_BAND_THRESHOLDS, weights: null },
    sources: accountSources,
    contributions,
    peerAverage,
    history: (history.get(accountId) ?? []).map((h) => ({ score: h.score, band: h.band, takenAt: h.takenAt.toISOString() })),
    contacts: contactRows.map((c) => ({ ...c, lastEngagedAt: c.lastEngagedAt?.toISOString() ?? null })),
    opportunities: opportunityRows,
    notes: noteRows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    activities: activityRows.map((a) => ({ ...a, occurredAt: a.occurredAt.toISOString() })),
    timeline: timelineRows.map((t) => ({ ...t, occurredAt: t.occurredAt.toISOString() })),
    runs: runs.map((r) => ({ id: r.id, agentId: r.agentId, agentName: r.agentName, status: r.status, outcome: r.outcome, sourceLabel: r.sourceLabel, startedAt: r.startedAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null })),
    openWork: openWork.map(serializeWork),
    completedWork: completedWork.map(serializeWork),
  };
}

function serializeWork(w: Awaited<ReturnType<typeof listWorkItems>>[number]) {
  return { ...w, dueAt: w.dueAt?.toISOString() ?? null, completedAt: w.completedAt?.toISOString() ?? null, createdAt: w.createdAt.toISOString(), snoozedUntil: w.snoozedUntil?.toISOString() ?? null };
}

export type AccountDetail = Awaited<ReturnType<typeof getAccountDetail>>;


async function assertLookups(ctx: ServiceContext, values: { lifecycleStageId: string; segmentId: string; ownerId: string | null }) {
  const [stages, segs, owners] = await Promise.all([listLifecycleStages(db, ctx.organizationId), listSegments(db, ctx.organizationId), listOrgUsers(db, ctx.organizationId)]);
  if (!stages.some((s) => s.id === values.lifecycleStageId)) throw new ValidationError("Unknown lifecycle stage", { fieldErrors: { lifecycleStageId: ["Unknown lifecycle stage"] } });
  const segment = segs.find((s) => s.id === values.segmentId);
  if (!segment) throw new ValidationError("Unknown segment", { fieldErrors: { segmentId: ["Unknown segment"] } });
  if (ctx.segmentScope.length && !ctx.segmentScope.includes(segment.name)) throw new ValidationError("You don't have access to that segment", { fieldErrors: { segmentId: ["Outside your access"] } });
  if (values.ownerId && !owners.some((o) => o.id === values.ownerId)) throw new ValidationError("Unknown owner", { fieldErrors: { ownerId: ["Unknown owner"] } });
}

export async function createAccount(ctx: ServiceContext, input: unknown): Promise<{ id: string }> {
  assertPermission(ctx, "accounts.write");
  const values = parseInput(accountFormSchema, input);
  await assertLookups(ctx, values);
  return db.transaction(async (tx) => {
    const [ws] = await tx.select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.organizationId, ctx.organizationId), eq(workspaces.isDefault, true))).limit(1);
    const created = await insertAccount(tx, ctx.organizationId, { ...values, workspaceId: ws?.id ?? null });
    await tx.insert(timelineEvents).values({ organizationId: ctx.organizationId, accountId: created.id, actorId: ctx.userId, kind: "account_created", title: "Account created", description: `Created by ${ctx.userName}` });
    await recalculateHealthScores(tx, ctx.organizationId, { accountIds: [created.id], reason: "account_created" });
    await recordAudit(tx, ctx, { action: "account.created", entityType: "account", entityId: created.id, summary: `Created account ${values.name}`, after: values });
    return created;
  });
}

export async function editAccount(ctx: ServiceContext, accountId: string, input: unknown): Promise<void> {
  assertPermission(ctx, "accounts.write");
  const before = await findAccountRow(db, ctx, accountId);
  if (!before) throw new NotFoundError("Account");
  const values = parseInput(accountFormSchema, input);
  await assertLookups(ctx, values);
  await db.transaction(async (tx) => {
    await updateAccount(tx, ctx.organizationId, accountId, values);
    if (before.lifecycleStageId !== values.lifecycleStageId || before.segmentId !== values.segmentId) {
      await recalculateHealthScores(tx, ctx.organizationId, { accountIds: [accountId], reason: "scorecard_changed" });
    }
    await recordAudit(tx, ctx, {
      action: "account.updated",
      entityType: "account",
      entityId: accountId,
      summary: `Edited account ${values.name}`,
      before: { name: before.name, domain: before.domain, industry: before.industry, lifecycleStageId: before.lifecycleStageId, segmentId: before.segmentId, ownerId: before.ownerId, arr: before.arr, renewalDate: before.renewalDate, licensedSeats: before.licensedSeats },
      after: values,
    });
  });
}


export async function addNote(ctx: ServiceContext, accountId: string, input: unknown) {
  assertPermission(ctx, "accounts.write");
  const { body } = parseInput(noteSchema, input);
  const account = await findAccountRow(db, ctx, accountId);
  if (!account) throw new NotFoundError("Account");
  return db.transaction(async (tx) => {
    const [note] = await tx.insert(notes).values({ organizationId: ctx.organizationId, accountId, authorId: ctx.userId, body }).returning({ id: notes.id });
    await touchAccountActivity(tx, ctx.organizationId, accountId);
    await recordAudit(tx, ctx, { action: "note.created", entityType: "account", entityId: accountId, summary: `Added note on ${account.name}: "${body.slice(0, 60)}${body.length > 60 ? "…" : ""}"` });
    return note;
  });
}


export async function createAccountTask(ctx: ServiceContext, accountId: string, input: unknown) {
  assertPermission(ctx, "work.manage");
  const values = parseInput(manualTaskSchema, input);
  const account = await findAccountRow(db, ctx, accountId);
  if (!account) throw new NotFoundError("Account");
  const owners = await listOrgUsers(db, ctx.organizationId);
  const ownerId = values.ownerId ?? account.ownerId ?? ctx.userId;
  if (ownerId && !owners.some((o) => o.id === ownerId)) throw new ValidationError("Unknown owner");
  return db.transaction(async (tx) => {
    const id = await insertWorkItem(tx, {
      organizationId: ctx.organizationId,
      accountId,
      ownerId,
      type: values.type,
      title: values.title,
      description: values.description ?? null,
      priority: values.priority,
      source: "manual",
      dueAt: addDays(new Date(), values.dueInDays),
      createdById: ctx.userId,
    });
    await recordAudit(tx, ctx, { action: "work.created", entityType: "work_item", entityId: id, summary: `Created ${values.type.replace("_", " ")} "${values.title}" for ${account.name}` });
    return { id };
  });
}

/** Lightweight lookup used by search and pickers. */
export async function getAccountNames(ctx: ServiceContext, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await listAccountRows(db, ctx, { ids });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

