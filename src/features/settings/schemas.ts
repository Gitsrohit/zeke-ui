import { z } from "zod";

export const settingsSchema = z.object({
  recalculationSchedule: z.enum(["realtime", "daily", "weekly"]),
  alertThreshold: z.coerce.number().int().min(0).max(100),
});
