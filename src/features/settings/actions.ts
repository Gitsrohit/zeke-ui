"use server";

import { revalidatePath } from "next/cache";
import { updateWorkspaceSettings } from "@/features/settings/services/settings.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function updateSettingsAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await updateWorkspaceSettings(ctx, input);
    revalidatePath("/admin/settings");
  });
}
