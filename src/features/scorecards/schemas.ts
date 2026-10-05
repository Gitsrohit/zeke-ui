import { z } from "zod";
import { HEALTH_SOURCE_KEYS } from "@/config/health";

/** Canonical scorecard update schema — client-safe; the service validates with it. */
const weightsSchema = z.object(Object.fromEntries(HEALTH_SOURCE_KEYS.map((k) => [k, z.coerce.number().int().min(0).max(100)])) as Record<(typeof HEALTH_SOURCE_KEYS)[number], z.ZodCoercedNumber>);

export const updateScorecardSchema = z.object({
  weights: weightsSchema,
  thresholds: z.object({ thriving: z.coerce.number().int(), stable: z.coerce.number().int(), atRisk: z.coerce.number().int() }),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an effective date"),
  changeNote: z.string().trim().max(300).optional(),
});
export type UpdateScorecardInput = z.input<typeof updateScorecardSchema>;

