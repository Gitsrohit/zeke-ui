import { z } from "zod";
import { accountFormSchema, manualTaskSchema, noteSchema } from "@/features/accounts/schemas";

/*
 * Form-input shapes for the account dialogs. Field rules are taken from the canonical
 * schemas in features/accounts/schemas.ts; optional inputs stay strings here (empty
 * string = unset) and the server action converts them before validating canonically.
 */
const a = accountFormSchema.shape;

export const accountFormClientSchema = z.object({
  name: a.name,
  domain: z.string().trim().max(120).regex(/^$|^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a domain like acme.com"),
  industry: z.string().trim().max(80),
  lifecycleStageId: a.lifecycleStageId,
  segmentId: a.segmentId,
  ownerId: z.string(),
  arr: z.coerce.number<string | number>().int("ARR must be a whole number").min(0, "ARR can't be negative").max(100_000_000),
  renewalDate: z.string(),
  licensedSeats: z.string(),
});
export type AccountFormValues = z.input<typeof accountFormClientSchema>;

const t = manualTaskSchema.shape;
export const taskClientSchema = z.object({
  title: t.title,
  type: t.type,
  priority: t.priority,
  dueInDays: z.coerce.number<string | number>().int().min(0, "Can't be in the past").max(365),
  description: z.string().trim().max(2000),
});
export type TaskFormValues = z.input<typeof taskClientSchema>;

export const noteClientSchema = noteSchema;
