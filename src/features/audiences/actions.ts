"use server";

import { revalidatePath } from "next/cache";
import { removeAudience, resolveAudienceMembers, saveAudience } from "@/features/audiences/services/audience.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function saveAudienceAction(input: unknown, audienceId?: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await saveAudience(ctx, input, audienceId);
    revalidatePath("/audiences");
    if (audienceId) revalidatePath(`/audiences/${audienceId}`);
    return result;
  });
}

export async function deleteAudienceAction(audienceId: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await removeAudience(ctx, audienceId);
    revalidatePath("/audiences");
  });
}

/** Resolves an audience's current members (live re-evaluation or frozen snapshot) for launching. */
export async function resolveAudienceMembersAction(audienceId: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const { members } = await resolveAudienceMembers(ctx, audienceId);
    return { accountIds: members.map((m) => m.id) };
  });
}
