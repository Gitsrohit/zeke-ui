"use server";

import { revalidatePath } from "next/cache";
import { completeWorkItem, reassignWorkItem, snoozeWorkItem } from "@/features/work/services/work.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function completeWorkItemAction(id: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await completeWorkItem(ctx, id, input);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function snoozeWorkItemAction(id: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await snoozeWorkItem(ctx, id, input);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function reassignWorkItemAction(id: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await reassignWorkItem(ctx, id, input);
    revalidatePath("/", "layout");
    return result;
  });
}
