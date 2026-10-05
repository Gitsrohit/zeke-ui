import { z } from "zod";

/** Canonical account schemas — client-safe (no server imports); services validate with these. */
export const accountFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  domain: z
    .string()
    .trim()
    .max(120)
    .regex(/^$|^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a domain like acme.com")
    .optional()
    .transform((v) => v || null),
  industry: z.string().trim().max(80).optional().transform((v) => v || null),
  lifecycleStageId: z.string().uuid("Choose a lifecycle stage"),
  segmentId: z.string().uuid("Choose a segment"),
  ownerId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  arr: z.coerce.number().int("ARR must be a whole number").min(0).max(100_000_000),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a renewal date").nullable().optional().transform((v) => v ?? null),
  licensedSeats: z.coerce.number().int().min(0).max(1_000_000).nullable().optional().transform((v) => v ?? null),
});

export type AccountFormInput = z.input<typeof accountFormSchema>;

export const noteSchema = z.object({ body: z.string().trim().min(1, "Write a note first").max(4000) });

export const manualTaskSchema = z.object({
  title: z.string().trim().min(3, "Describe the task").max(200),
  type: z.enum(["task", "call", "email", "follow_up", "review"]),
  priority: z.enum(["low", "medium", "high"]),
  dueInDays: z.coerce.number().int().min(0).max(365),
  ownerId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(2000).optional(),
});
