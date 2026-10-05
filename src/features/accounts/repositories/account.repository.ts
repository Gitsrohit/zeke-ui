import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { HealthBandKey, HealthSourceKey } from "@/config/health";
import type { DbExecutor } from "@/lib/db/client";
import { accounts, healthScores, lifecycleStages, segments, users } from "@/lib/db/schema";

export interface AccountRow {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  status: "active" | "churned";
  lifecycleStageId: string;
  lifecycle: string;
  segmentId: string;
  segment: string;
  ownerId: string | null;
  ownerName: string | null;
  arr: number;
  renewalDate: string | null;
  nps: number | null;
  openTickets: number;
  licensedSeats: number | null;
  lastMeetingAt: Date | null;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
  keyRolesDocumented: number;
  keyRolesTotal: number;
  score: number | null;
  band: HealthBandKey | null;
  predictiveRisk: number | null;
  trendDelta: number | null;
  weakestSource: HealthSourceKey | null;
  calculatedAt: Date | null;
  createdAt: Date;
}

export interface AccountScope {
  organizationId: string;
  /** Segment names the viewer may access; empty = all. */
  segmentScope: readonly string[];
}

const accountColumns = {
  id: accounts.id,
  name: accounts.name,
  domain: accounts.domain,
  industry: accounts.industry,
  status: accounts.status,
  lifecycleStageId: accounts.lifecycleStageId,
  lifecycle: lifecycleStages.name,
  segmentId: accounts.segmentId,
  segment: segments.name,
  ownerId: accounts.ownerId,
  ownerName: users.name,
  arr: accounts.arr,
  renewalDate: accounts.renewalDate,
  nps: accounts.nps,
  openTickets: accounts.openTickets,
  licensedSeats: accounts.licensedSeats,
  lastMeetingAt: accounts.lastMeetingAt,
  lastLoginAt: accounts.lastLoginAt,
  lastActivityAt: accounts.lastActivityAt,
  keyRolesDocumented: accounts.keyRolesDocumented,
  keyRolesTotal: accounts.keyRolesTotal,
  score: healthScores.score,
  band: healthScores.band,
  predictiveRisk: healthScores.predictiveRisk,
  trendDelta: healthScores.trendDelta,
  weakestSource: healthScores.weakestSource,
  calculatedAt: healthScores.calculatedAt,
  createdAt: accounts.createdAt,
};

function scopeConditions(scope: AccountScope): SQL[] {
  const conditions: SQL[] = [eq(accounts.organizationId, scope.organizationId)];
  if (scope.segmentScope.length > 0) conditions.push(inArray(segments.name, [...scope.segmentScope]));
  return conditions;
}

function baseQuery(executor: DbExecutor) {
  return executor
    .select(accountColumns)
    .from(accounts)
    .innerJoin(lifecycleStages, eq(accounts.lifecycleStageId, lifecycleStages.id))
    .innerJoin(segments, eq(accounts.segmentId, segments.id))
    .leftJoin(users, eq(accounts.ownerId, users.id))
    .leftJoin(healthScores, eq(healthScores.accountId, accounts.id));
}

export async function listAccountRows(
  executor: DbExecutor,
  scope: AccountScope,
  options: { ids?: readonly string[]; activeOnly?: boolean } = {},
): Promise<AccountRow[]> {
  const conditions = scopeConditions(scope);
  if (options.ids) {
    if (options.ids.length === 0) return [];
    conditions.push(inArray(accounts.id, [...options.ids]));
  }
  if (options.activeOnly) conditions.push(eq(accounts.status, "active"));
  return baseQuery(executor)
    .where(and(...conditions))
    .orderBy(asc(accounts.name));
}

export async function findAccountRow(executor: DbExecutor, scope: AccountScope, accountId: string): Promise<AccountRow | null> {
  const [row] = await baseQuery(executor)
    .where(and(...scopeConditions(scope), eq(accounts.id, accountId)))
    .limit(1);
  return row ?? null;
}

export const ACCOUNT_SORT_KEYS = ["name", "arr", "score", "trend", "risk", "renewal", "activity", "owner", "lifecycle", "segment"] as const;
export type AccountSortKey = (typeof ACCOUNT_SORT_KEYS)[number];

export interface AccountPageQuery {
  q?: string;
  lifecycle?: string[];
  segment?: string[];
  band?: HealthBandKey[];
  ownerId?: string[];
  sort: AccountSortKey;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

const SORT_COLUMNS: Record<AccountSortKey, SQL | typeof accounts.name> = {
  name: sql`lower(${accounts.name})`,
  arr: sql`${accounts.arr}`,
  score: sql`${healthScores.score}`,
  trend: sql`${healthScores.trendDelta}`,
  risk: sql`${healthScores.predictiveRisk}`,
  renewal: sql`${accounts.renewalDate}`,
  activity: sql`${accounts.lastActivityAt}`,
  owner: sql`lower(${users.name})`,
  lifecycle: sql`${lifecycleStages.position}`,
  segment: sql`${segments.position}`,
};

export async function listAccountsPage(
  executor: DbExecutor,
  scope: AccountScope,
  query: AccountPageQuery,
): Promise<{ rows: AccountRow[]; total: number }> {
  const conditions = scopeConditions(scope);
  if (query.q) {
    const pattern = `%${query.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const searchCondition = or(ilike(accounts.name, pattern), ilike(users.name, pattern), ilike(accounts.domain, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }
  if (query.lifecycle?.length) conditions.push(inArray(lifecycleStages.name, query.lifecycle));
  if (query.segment?.length) conditions.push(inArray(segments.name, query.segment));
  if (query.band?.length) conditions.push(inArray(healthScores.band, query.band));
  if (query.ownerId?.length) conditions.push(inArray(accounts.ownerId, query.ownerId));

  const where = and(...conditions);
  const sortColumn = SORT_COLUMNS[query.sort];
  const order = query.direction === "asc" ? sql`${sortColumn} asc nulls last` : sql`${sortColumn} desc nulls last`;

  const [rows, [{ total }]] = await Promise.all([
    baseQuery(executor)
      .where(where)
      .orderBy(order, asc(accounts.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    executor
      .select({ total: count() })
      .from(accounts)
      .innerJoin(lifecycleStages, eq(accounts.lifecycleStageId, lifecycleStages.id))
      .innerJoin(segments, eq(accounts.segmentId, segments.id))
      .leftJoin(users, eq(accounts.ownerId, users.id))
      .leftJoin(healthScores, eq(healthScores.accountId, accounts.id))
      .where(where),
  ]);
  return { rows, total };
}

export async function searchAccountRows(executor: DbExecutor, scope: AccountScope, q: string, limit: number): Promise<AccountRow[]> {
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return baseQuery(executor)
    .where(and(...scopeConditions(scope), or(ilike(accounts.name, pattern), ilike(accounts.domain, pattern))))
    .orderBy(desc(accounts.arr))
    .limit(limit);
}

export async function listLifecycleStages(executor: DbExecutor, organizationId: string) {
  return executor
    .select({ id: lifecycleStages.id, name: lifecycleStages.name })
    .from(lifecycleStages)
    .where(eq(lifecycleStages.organizationId, organizationId))
    .orderBy(asc(lifecycleStages.position));
}

export async function listSegments(executor: DbExecutor, organizationId: string) {
  return executor
    .select({ id: segments.id, name: segments.name })
    .from(segments)
    .where(eq(segments.organizationId, organizationId))
    .orderBy(asc(segments.position));
}

export interface AccountWriteValues {
  name: string;
  domain: string | null;
  industry: string | null;
  lifecycleStageId: string;
  segmentId: string;
  ownerId: string | null;
  arr: number;
  renewalDate: string | null;
  licensedSeats: number | null;
}

export async function insertAccount(executor: DbExecutor, organizationId: string, values: AccountWriteValues & { workspaceId: string | null }) {
  const [row] = await executor
    .insert(accounts)
    .values({ ...values, organizationId })
    .returning({ id: accounts.id });
  return row;
}

export async function updateAccount(executor: DbExecutor, organizationId: string, accountId: string, values: Partial<AccountWriteValues>) {
  const [row] = await executor
    .update(accounts)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(accounts.organizationId, organizationId), eq(accounts.id, accountId)))
    .returning({ id: accounts.id });
  return row ?? null;
}

export async function touchAccountActivity(executor: DbExecutor, organizationId: string, accountId: string, at: Date = new Date()) {
  await executor
    .update(accounts)
    .set({ lastActivityAt: at })
    .where(and(eq(accounts.organizationId, organizationId), eq(accounts.id, accountId)));
}

export async function countAccounts(executor: DbExecutor, scope: AccountScope): Promise<number> {
  const [{ total }] = await executor
    .select({ total: count() })
    .from(accounts)
    .innerJoin(segments, eq(accounts.segmentId, segments.id))
    .where(and(...scopeConditions(scope)));
  return total;
}
