import { z } from "zod";
import { AUDIENCE_FIELD_KEYS, AUDIENCE_OPERATORS, type AudienceGroup } from "./domain/types";
import { getAudienceField, operatorsForField } from "./domain/fields";

const MAX_DEPTH = 3;

export const audienceConditionSchema = z
  .object({
    id: z.string().min(1).max(64),
    field: z.enum(AUDIENCE_FIELD_KEYS),
    operator: z.enum(AUDIENCE_OPERATORS),
    value: z.union([z.string().max(200), z.number().finite(), z.array(z.string().max(200)).max(50)]),
  })
  .superRefine((c, ctx) => {
    if (!operatorsForField(c.field).includes(c.operator)) {
      ctx.addIssue({ code: "custom", message: `Operator "${c.operator}" is not valid for ${getAudienceField(c.field).label}` });
    }
    const multi = c.operator === "in" || c.operator === "notIn";
    if (multi !== Array.isArray(c.value)) {
      ctx.addIssue({ code: "custom", message: multi ? "Choose at least one value" : "Value must be a single value" });
    }
    if (Array.isArray(c.value) && c.value.length === 0) {
      ctx.addIssue({ code: "custom", message: "Choose at least one value" });
    }
    if (getAudienceField(c.field).type === "number" && !Array.isArray(c.value) && !Number.isFinite(Number(c.value))) {
      ctx.addIssue({ code: "custom", message: `${getAudienceField(c.field).label} needs a number` });
    }
  });

export const audienceGroupSchema: z.ZodType<AudienceGroup> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    combinator: z.enum(["and", "or"]),
    conditions: z.array(audienceConditionSchema).max(25),
    groups: z.array(audienceGroupSchema).max(10),
  }),
);

function depth(g: AudienceGroup): number {
  return 1 + Math.max(0, ...g.groups.map(depth));
}

export const audienceFilterSchema = z
  .object({
    combinator: z.enum(["and", "or"]),
    groups: z.array(audienceGroupSchema).max(10),
  })
  .refine((f) => f.groups.every((g) => depth(g) <= MAX_DEPTH), { message: `Groups can be nested at most ${MAX_DEPTH} levels deep` });

export const saveAudienceSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  description: z.string().trim().max(500).optional(),
  type: z.enum(["dynamic", "static"]),
  filter: audienceFilterSchema,
});

export type SaveAudienceInput = z.infer<typeof saveAudienceSchema>;
