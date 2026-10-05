"use server";

import { revalidatePath } from "next/cache";
import { dismissRisk } from "@/features/outcomes/services/outcome.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function dismissRiskAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await dismissRisk(ctx, input);
    revalidatePath("/", "layout");
  });
}
