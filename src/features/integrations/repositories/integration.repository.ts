import { and, asc, eq } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/client";
import { integrationConnections, integrations, users, type IntegrationConfig } from "@/lib/db/schema";

export async function listIntegrations(executor: DbExecutor, organizationId: string) {
  return executor
    .select({
      key: integrations.key,
      name: integrations.name,
      code: integrations.code,
      category: integrations.category,
      description: integrations.description,
      connectionId: integrationConnections.id,
      status: integrationConnections.status,
      config: integrationConnections.config,
      lastSyncedAt: integrationConnections.lastSyncedAt,
      lastSyncStatus: integrationConnections.lastSyncStatus,
      connectedAt: integrationConnections.connectedAt,
      connectedByName: users.name,
    })
    .from(integrations)
    .leftJoin(
      integrationConnections,
      and(eq(integrationConnections.integrationKey, integrations.key), eq(integrationConnections.organizationId, organizationId)),
    )
    .leftJoin(users, eq(integrationConnections.connectedById, users.id))
    .orderBy(asc(integrations.name));
}

export async function findIntegration(executor: DbExecutor, key: string) {
  const [row] = await executor.select().from(integrations).where(eq(integrations.key, key)).limit(1);
  return row ?? null;
}

export async function findConnection(executor: DbExecutor, organizationId: string, key: string) {
  const [row] = await executor
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.organizationId, organizationId), eq(integrationConnections.integrationKey, key)))
    .limit(1);
  return row ?? null;
}

export async function upsertConnection(
  executor: DbExecutor,
  organizationId: string,
  key: string,
  values: Partial<Omit<typeof integrationConnections.$inferInsert, "organizationId" | "integrationKey">> & { config?: IntegrationConfig },
) {
  await executor
    .insert(integrationConnections)
    .values({ organizationId, integrationKey: key, ...values })
    .onConflictDoUpdate({
      target: [integrationConnections.organizationId, integrationConnections.integrationKey],
      set: { ...values, updatedAt: new Date() },
    });
}

export async function isIntegrationConnected(executor: DbExecutor, organizationId: string, key: string): Promise<boolean> {
  const conn = await findConnection(executor, organizationId, key);
  return conn?.status === "connected";
}
