import { insertAuditLog } from "@/features/audit/repositories/audit.repository";
import type { DbExecutor } from "@/lib/db/client";
import type { ServiceContext } from "@/lib/server/context";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}

/** Writes an audit event attributed to the acting user (or automation). */
export async function recordAudit(executor: DbExecutor, ctx: ServiceContext, entry: AuditEntry): Promise<void> {
  await insertAuditLog(executor, {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorName: ctx.userName,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ipAddress: ctx.request?.ipAddress ?? null,
    userAgent: ctx.request?.userAgent ?? null,
  });
}
