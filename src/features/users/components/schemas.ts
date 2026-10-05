import { z } from "zod";
import { inviteSchema, updateMemberSchema } from "@/features/users/schemas";

/** Form shapes derived from the canonical user schemas (title is a plain string in the form). */
export const inviteFormSchema = inviteSchema.extend({ title: z.string().trim().max(80), segments: updateMemberSchema.shape.segments });
export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export const memberFormSchema = updateMemberSchema.extend({ title: z.string().trim().max(80) });
export type MemberFormValues = z.infer<typeof memberFormSchema>;
