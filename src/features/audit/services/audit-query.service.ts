import { z } from "zod";
import { listAuditLogs, listEntityTypes } from "@/features/audit/repositories/audit.repository";
import { db } from "@/lib/db/client";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";

export const auditQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(40).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export async function getAuditLog(ctx: ServiceContext, input: unknown) {
  assertPermission(ctx, "audit.read");
  const q = parseInput(auditQuerySchema, input);
  const pageSize = 25;
  const [{ rows, total }, entityTypes] = await Promise.all([
    listAuditLogs(db, ctx.organizationId, { q: q.q, entityType: q.entityType || undefined, since: q.days ? new Date(Date.now() - q.days * 86_400_000) : undefined, page: q.page, pageSize }),
    listEntityTypes(db, ctx.organizationId),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    page: q.page,
    pageSize,
    entityTypes,
    query: q,
  };
}

export type AuditEntryView = Awaited<ReturnType<typeof getAuditLog>>["rows"][number];
