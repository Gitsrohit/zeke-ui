"use server";

import { revalidatePath } from "next/cache";
import { addNote, createAccount, createAccountTask, editAccount } from "@/features/accounts/services/account.service";
import { recalculateAll } from "@/features/scorecards/services/scorecard.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function createAccountAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const created = await createAccount(ctx, input);
    revalidatePath("/", "layout");
    return created;
  });
}

export async function editAccountAction(accountId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await editAccount(ctx, accountId, input);
    revalidatePath("/", "layout");
  });
}

export async function addNoteAction(accountId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const note = await addNote(ctx, accountId, input);
    revalidatePath(`/accounts/${accountId}`);
    return note;
  });
}

export async function createAccountTaskAction(accountId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const task = await createAccountTask(ctx, accountId, input);
    revalidatePath("/", "layout");
    return task;
  });
}

export async function recalculateHealthAction() {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await recalculateAll(ctx);
    revalidatePath("/", "layout");
    return result;
  });
}
