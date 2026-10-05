import { z } from "zod";
import { AUDIENCE_FIELD_KEYS, AUDIENCE_OPERATORS } from "@/features/audiences/domain/types";
import type { AgentStepNode } from "./domain/types";

const id = z.string().min(1).max(64);

const emailConfig = z.object({ templateKey: z.string().min(1).max(64), requiresApproval: z.boolean() }).strict();
const taskConfig = z
  .object({ title: z.string().trim().max(200), ownerRole: z.string().trim().min(1).max(40), dueInDays: z.number().int().min(0).max(365), priority: z.enum(["low", "medium", "high"]) })
  .strict();
const waitConfig = z.object({ duration: z.number().min(0).max(365), unit: z.enum(["hours", "days"]) }).strict();
const conditionConfig = z
  .object({
    mode: z.enum(["manual", "auto"]),
    label: z.string().trim().max(200),
    field: z.enum(AUDIENCE_FIELD_KEYS).optional(),
    operator: z.enum(AUDIENCE_OPERATORS).optional(),
    value: z.union([z.string().max(200), z.number(), z.array(z.string().max(200)).max(20)]).optional(),
  })
  .strict();
const apiConfig = z.object({ method: z.enum(["GET", "POST", "PUT", "PATCH"]), endpoint: z.string().trim().max(300), payload: z.string().max(4000) }).strict();
const approvalConfig = z.object({ title: z.string().trim().min(1).max(200), approverRole: z.string().trim().min(1).max(60) }).strict();
const stopConfig = z.object({ reason: z.string().trim().max(200) }).strict();

const leafStep = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("email"), config: emailConfig }),
  z.object({ id, type: z.literal("task"), config: taskConfig }),
  z.object({ id, type: z.literal("wait"), config: waitConfig }),
  z.object({ id, type: z.literal("api"), config: apiConfig }),
  z.object({ id, type: z.literal("approval"), config: approvalConfig }),
  z.object({ id, type: z.literal("stop"), config: stopConfig }),
]);

const conditionStep = z.object({
  id,
  type: z.literal("condition"),
  config: conditionConfig,
  branches: z.object({ yes: z.array(leafStep).max(20), no: z.array(leafStep).max(20) }),
});

/** Conditions are top-level only; their branches contain leaf steps. */
export const agentStepSchema = z.union([conditionStep, leafStep]) as unknown as z.ZodType<AgentStepNode>;
export const agentStepsSchema = z.array(agentStepSchema).min(1, "Add at least one step").max(40);
