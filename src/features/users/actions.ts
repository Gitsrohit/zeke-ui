"use server";

import { revalidatePath } from "next/cache";
import { inviteUser, regenerateInvite, setMemberActive, updateMember } from "@/features/users/services/user.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function inviteUserAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await inviteUser(ctx, input);
    revalidatePath("/admin/users");
    return result;
  });
}

export async function updateMemberAction(membershipId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await updateMember(ctx, membershipId, input);
    revalidatePath("/admin/users");
  });
}

export async function setMemberActiveAction(membershipId: string, active: boolean) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await setMemberActive(ctx, membershipId, active);
    revalidatePath("/admin/users");
  });
}

export async function regenerateInviteAction(membershipId: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    return regenerateInvite(ctx, membershipId);
  });
}
