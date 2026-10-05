import { z } from "zod";
import { HEALTH_SOURCES } from "@/config/health";
import { countAccounts } from "@/features/accounts/repositories/account.repository";
import { recordAudit } from "@/features/audit/services/audit.service";
import { recalculateHealthScores } from "@/features/health/services/health-calculation.service";
import { findConnection, findIntegration, listIntegrations, upsertConnection } from "@/features/integrations/repositories/integration.repository";
import { db } from "@/lib/db/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";

export async function getIntegrations(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const rows = await listIntegrations(db, ctx.organizationId);
  return rows.map((r) => ({
    ...r,
    status: r.status ?? ("disconnected" as const),
    feeds: HEALTH_SOURCES.filter((s) => s.integration === r.key).map((s) => s.name),
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    connectedAt: r.connectedAt?.toISOString() ?? null,
  }));
}

export type IntegrationView = Awaited<ReturnType<typeof getIntegrations>>[number];

async function load(ctx: ServiceContext, key: string) {
  assertPermission(ctx, "integrations.manage");
  const integration = await findIntegration(db, key);
  if (!integration) throw new NotFoundError("Integration");
  return integration;
}

export async function connectIntegration(ctx: ServiceContext, key: string) {
  const integration = await load(ctx, key);
  const now = new Date();
  await db.transaction(async (tx) => {
    await upsertConnection(tx, ctx.organizationId, key, { status: "connected", connectedAt: now, connectedById: ctx.userId, lastSyncStatus: "Awaiting first sync" });
    await recordAudit(tx, ctx, { action: "integration.connected", entityType: "integration", entityId: key, summary: `${integration.name} connected` });
  });
}

export async function disconnectIntegration(ctx: ServiceContext, key: string) {
  const integration = await load(ctx, key);
  await db.transaction(async (tx) => {
    await upsertConnection(tx, ctx.organizationId, key, { status: "disconnected", lastSyncStatus: null });
    await recordAudit(tx, ctx, { action: "integration.disconnected", entityType: "integration", entityId: key, summary: `${integration.name} disconnected` });
  });
}

export const integrationConfigSchema = z.object({ syncFrequency: z.enum(["hourly", "daily", "weekly"]) });

export async function configureIntegration(ctx: ServiceContext, key: string, input: unknown) {
  const integration = await load(ctx, key);
  const config = parseInput(integrationConfigSchema, input);
  const before = await findConnection(db, ctx.organizationId, key);
  await db.transaction(async (tx) => {
    await upsertConnection(tx, ctx.organizationId, key, { config });
    await recordAudit(tx, ctx, { action: "integration.configured", entityType: "integration", entityId: key, summary: `${integration.name} sync set to ${config.syncFrequency}`, before: before?.config, after: config });
  });
}

/**
 * Runs a sync. Connectors run in demo mode in this environment: no external API is
 * called — the sync refreshes health scores from the latest stored source data and
 * records the run so the connection status is accurate.
 */
export async function syncIntegration(ctx: ServiceContext, key: string) {
  const integration = await load(ctx, key);
  const conn = await findConnection(db, ctx.organizationId, key);
  if (conn?.status !== "connected") throw new ConflictError(`Connect ${integration.name} before syncing.`);
  const now = new Date();
  return db.transaction(async (tx) => {
    const result = await recalculateHealthScores(tx, ctx.organizationId, { reason: `sync:${key}`, now });
    const total = await countAccounts(tx, { organizationId: ctx.organizationId, segmentScope: [] });
    const status = `Synced ${total} accounts (demo mode)`;
    await upsertConnection(tx, ctx.organizationId, key, { lastSyncedAt: now, lastSyncStatus: status });
    await recordAudit(tx, ctx, { action: "integration.synced", entityType: "integration", entityId: key, summary: `${integration.name}: ${status}, ${result.scoresChanged} scores changed` });
    return { status, lastSyncedAt: now.toISOString() };
  });
}
