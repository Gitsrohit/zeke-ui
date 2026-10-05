"use server";

import { revalidatePath } from "next/cache";
import { configureIntegration, connectIntegration, disconnectIntegration, syncIntegration } from "@/features/integrations/services/integration.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function connectIntegrationAction(key: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await connectIntegration(ctx, key);
    revalidatePath("/admin/integrations");
  });
}

export async function disconnectIntegrationAction(key: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await disconnectIntegration(ctx, key);
    revalidatePath("/admin/integrations");
  });
}

export async function configureIntegrationAction(key: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await configureIntegration(ctx, key, input);
    revalidatePath("/admin/integrations");
  });
}

export async function syncIntegrationAction(key: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await syncIntegration(ctx, key);
    revalidatePath("/admin/integrations");
    return result;
  });
}
