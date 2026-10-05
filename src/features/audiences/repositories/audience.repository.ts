import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/client";
import { audienceConditions, audienceGroups, audienceMemberships, audiences, users } from "@/lib/db/schema";
import type { AudienceCondition, AudienceFieldKey, AudienceFilter, AudienceGroup, AudienceOperator, AudienceType, Combinator } from "@/features/audiences/domain/types";

export interface AudienceRecord {
  id: string;
  name: string;
  description: string | null;
  type: AudienceType;
  filter: AudienceFilter;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastEvaluatedAt: Date | null;
  lastMemberCount: number | null;
}

interface GroupRow {
  id: string;
  audienceId: string;
  parentGroupId: string | null;
  combinator: Combinator;
  position: number;
}

interface ConditionRow {
  id: string;
  groupId: string;
  field: string;
  operator: string;
  value: AudienceCondition["value"];
  position: number;
}

function assembleFilters(rootCombinators: Map<string, Combinator>, groups: GroupRow[], conditions: ConditionRow[]): Map<string, AudienceFilter> {
  const conditionsByGroup = new Map<string, ConditionRow[]>();
  for (const c of conditions) {
    const list = conditionsByGroup.get(c.groupId) ?? [];
    list.push(c);
    conditionsByGroup.set(c.groupId, list);
  }
  const childrenByParent = new Map<string, GroupRow[]>();
  for (const g of groups) {
    const key = g.parentGroupId ?? `root:${g.audienceId}`;
    const list = childrenByParent.get(key) ?? [];
    list.push(g);
    childrenByParent.set(key, list);
  }
  const build = (g: GroupRow): AudienceGroup => ({
    id: g.id,
    combinator: g.combinator,
    conditions: (conditionsByGroup.get(g.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, field: c.field as AudienceFieldKey, operator: c.operator as AudienceOperator, value: c.value })),
    groups: (childrenByParent.get(g.id) ?? []).sort((a, b) => a.position - b.position).map(build),
  });
  const result = new Map<string, AudienceFilter>();
  for (const [audienceId, combinator] of rootCombinators) {
    result.set(audienceId, {
      combinator,
      groups: (childrenByParent.get(`root:${audienceId}`) ?? []).sort((a, b) => a.position - b.position).map(build),
    });
  }
  return result;
}

async function loadFilters(executor: DbExecutor, audienceRows: Array<{ id: string; rootCombinator: Combinator }>) {
  if (audienceRows.length === 0) return new Map<string, AudienceFilter>();
  const ids = audienceRows.map((a) => a.id);
  const groups = await executor
    .select({ id: audienceGroups.id, audienceId: audienceGroups.audienceId, parentGroupId: audienceGroups.parentGroupId, combinator: audienceGroups.combinator, position: audienceGroups.position })
    .from(audienceGroups)
    .where(inArray(audienceGroups.audienceId, ids));
  const conditions = groups.length
    ? await executor
        .select({ id: audienceConditions.id, groupId: audienceConditions.groupId, field: audienceConditions.field, operator: audienceConditions.operator, value: audienceConditions.value, position: audienceConditions.position })
        .from(audienceConditions)
        .where(inArray(audienceConditions.groupId, groups.map((g) => g.id)))
    : [];
  return assembleFilters(new Map(audienceRows.map((a) => [a.id, a.rootCombinator])), groups, conditions);
}

const audienceColumns = {
  id: audiences.id,
  name: audiences.name,
  description: audiences.description,
  type: audiences.type,
  rootCombinator: audiences.rootCombinator,
  createdByName: users.name,
  createdAt: audiences.createdAt,
  updatedAt: audiences.updatedAt,
  lastEvaluatedAt: audiences.lastEvaluatedAt,
  lastMemberCount: audiences.lastMemberCount,
};

export async function listAudiences(executor: DbExecutor, organizationId: string): Promise<AudienceRecord[]> {
  const rows = await executor
    .select(audienceColumns)
    .from(audiences)
    .leftJoin(users, eq(audiences.createdById, users.id))
    .where(eq(audiences.organizationId, organizationId))
    .orderBy(desc(audiences.updatedAt));
  const filters = await loadFilters(executor, rows);
  return rows.map(({ rootCombinator, ...r }) => ({ ...r, filter: filters.get(r.id) ?? { combinator: rootCombinator, groups: [] } }));
}

export async function findAudience(executor: DbExecutor, organizationId: string, audienceId: string): Promise<AudienceRecord | null> {
  const [row] = await executor
    .select(audienceColumns)
    .from(audiences)
    .leftJoin(users, eq(audiences.createdById, users.id))
    .where(and(eq(audiences.organizationId, organizationId), eq(audiences.id, audienceId)))
    .limit(1);
  if (!row) return null;
  const filters = await loadFilters(executor, [row]);
  const { rootCombinator, ...rest } = row;
  return { ...rest, filter: filters.get(row.id) ?? { combinator: rootCombinator, groups: [] } };
}

async function insertGroups(executor: DbExecutor, audienceId: string, groups: AudienceGroup[], parentGroupId: string | null) {
  for (const [position, group] of groups.entries()) {
    const [row] = await executor
      .insert(audienceGroups)
      .values({ audienceId, parentGroupId, combinator: group.combinator, position })
      .returning({ id: audienceGroups.id });
    if (group.conditions.length) {
      await executor.insert(audienceConditions).values(
        group.conditions.map((c, i) => ({ groupId: row.id, field: c.field, operator: c.operator, value: c.value, position: i })),
      );
    }
    await insertGroups(executor, audienceId, group.groups, row.id);
  }
}

/** Creates or fully replaces an audience definition (groups and conditions are rewritten). */
export async function saveAudienceTree(
  executor: DbExecutor,
  input: {
    organizationId: string;
    createdById: string | null;
    audienceId?: string;
    name: string;
    description?: string | null;
    type: AudienceType;
    filter: AudienceFilter;
  },
): Promise<string> {
  let audienceId = input.audienceId;
  if (audienceId) {
    await executor
      .update(audiences)
      .set({ name: input.name, description: input.description ?? null, type: input.type, rootCombinator: input.filter.combinator, updatedAt: new Date() })
      .where(and(eq(audiences.organizationId, input.organizationId), eq(audiences.id, audienceId)));
    await executor.delete(audienceGroups).where(eq(audienceGroups.audienceId, audienceId));
  } else {
    const [row] = await executor
      .insert(audiences)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        rootCombinator: input.filter.combinator,
        createdById: input.createdById,
      })
      .returning({ id: audiences.id });
    audienceId = row.id;
  }
  await insertGroups(executor, audienceId, input.filter.groups, null);
  return audienceId;
}

export async function deleteAudience(executor: DbExecutor, organizationId: string, audienceId: string): Promise<boolean> {
  const rows = await executor
    .delete(audiences)
    .where(and(eq(audiences.organizationId, organizationId), eq(audiences.id, audienceId)))
    .returning({ id: audiences.id });
  return rows.length > 0;
}

export async function replaceStaticMembers(executor: DbExecutor, organizationId: string, audienceId: string, accountIds: readonly string[]) {
  await executor.delete(audienceMemberships).where(eq(audienceMemberships.audienceId, audienceId));
  if (accountIds.length) {
    await executor.insert(audienceMemberships).values(accountIds.map((accountId) => ({ organizationId, audienceId, accountId })));
  }
}

export async function getStaticMemberIds(executor: DbExecutor, organizationId: string, audienceIds: readonly string[]): Promise<Map<string, string[]>> {
  if (audienceIds.length === 0) return new Map();
  const rows = await executor
    .select({ audienceId: audienceMemberships.audienceId, accountId: audienceMemberships.accountId })
    .from(audienceMemberships)
    .where(and(eq(audienceMemberships.organizationId, organizationId), inArray(audienceMemberships.audienceId, [...audienceIds])))
    .orderBy(asc(audienceMemberships.addedAt));
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.audienceId) ?? [];
    list.push(r.accountId);
    map.set(r.audienceId, list);
  }
  return map;
}

export async function recordEvaluation(executor: DbExecutor, audienceId: string, count: number) {
  await executor.update(audiences).set({ lastEvaluatedAt: new Date(), lastMemberCount: count }).where(eq(audiences.id, audienceId));
}
