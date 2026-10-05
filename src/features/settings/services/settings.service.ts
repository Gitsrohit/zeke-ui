import { eq } from "drizzle-orm";
import { settingsSchema } from "@/features/settings/schemas";
import { recordAudit } from "@/features/audit/services/audit.service";
import { db } from "@/lib/db/client";
import { workspaceSettings } from "@/lib/db/schema";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";

export async function getWorkspaceSettings(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const [row] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.organizationId, ctx.organizationId)).limit(1);
  return { recalculationSchedule: row?.recalculationSchedule ?? "realtime", alertThreshold: row?.alertThreshold ?? 55 };
}


export async function updateWorkspaceSettings(ctx: ServiceContext, input: unknown) {
  assertPermission(ctx, "settings.manage");
  const values = parseInput(settingsSchema, input);
  const before = await getWorkspaceSettings(ctx);
  await db.transaction(async (tx) => {
    await tx
      .insert(workspaceSettings)
      .values({ organizationId: ctx.organizationId, ...values })
      .onConflictDoUpdate({ target: workspaceSettings.organizationId, set: { ...values, updatedAt: new Date() } });
    await recordAudit(tx, ctx, { action: "settings.updated", entityType: "workspace", summary: `Recalculation: ${values.recalculationSchedule}; CSM alert threshold: ${values.alertThreshold}`, before, after: values });
  });
}
