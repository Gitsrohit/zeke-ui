import { and, count, desc, eq, gte, ilike, or, type SQL } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

export type AuditInsert = Omit<typeof auditLogs.$inferInsert, "id" | "createdAt">;

export async function insertAuditLog(executor: DbExecutor, values: AuditInsert): Promise<void> {
  await executor.insert(auditLogs).values(values);
}

export interface AuditQuery {
  q?: string;
  entityType?: string;
  since?: Date;
  page: number;
  pageSize: number;
}

export async function listAuditLogs(executor: DbExecutor, organizationId: string, query: AuditQuery) {
  const conditions: SQL[] = [eq(auditLogs.organizationId, organizationId)];
  if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
  if (query.since) conditions.push(gte(auditLogs.createdAt, query.since));
  if (query.q) {
    const pattern = `%${query.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const search = or(ilike(auditLogs.summary, pattern), ilike(auditLogs.actorName, pattern), ilike(auditLogs.action, pattern));
    if (search) conditions.push(search);
  }
  const where = and(...conditions);
  const [rows, [{ total }]] = await Promise.all([
    executor
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    executor.select({ total: count() }).from(auditLogs).where(where),
  ]);
  return { rows, total };
}

export async function listEntityTypes(executor: DbExecutor, organizationId: string): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ entityType: auditLogs.entityType })
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId));
  return rows.map((r) => r.entityType).sort();
}
