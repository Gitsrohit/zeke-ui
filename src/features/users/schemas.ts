import { z } from "zod";
import { SEGMENTS } from "@/config/health";
import { ROLE_KEYS } from "@/lib/permissions";

const segmentsSchema = z.array(z.enum(SEGMENTS)).max(SEGMENTS.length);

export const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(ROLE_KEYS),
  title: z.string().trim().max(80).optional(),
  segments: segmentsSchema.default([]),
});

export const updateMemberSchema = z.object({
  role: z.enum(ROLE_KEYS),
  title: z.string().trim().max(80).optional(),
  segments: segmentsSchema,
});
