import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { EMAIL_TEMPLATES } from "@/config/email-templates";
import { HEALTH_BAND_ORDER, HEALTH_SOURCES, LIFECYCLE_STAGES, SEGMENTS } from "@/config/health";
import { defaultStepConfig } from "@/features/agents/domain/steps";
import type { AgentStepNode } from "@/features/agents/domain/types";
import { nodeId, normalizeFilter } from "@/features/audiences/domain/builders";
import { describeCondition } from "@/features/audiences/domain/evaluate";
import { AUDIENCE_FIELDS } from "@/features/audiences/domain/fields";
import { AUDIENCE_FIELD_KEYS, AUDIENCE_OPERATORS, type AudienceCondition } from "@/features/audiences/domain/types";
import { audienceConditionSchema } from "@/features/audiences/schemas";
import { logger } from "@/lib/logger";
import type { AgentWorkflowResult, AIProvider, AssistantAnswer, AssistantContext, AudienceParseContext, AudienceParseResult } from "../types";
import { RuleBasedAIProvider } from "./rule-based";

const AudienceParseSchema = z.object({
  groups: z.array(
    z.object({
      conditions: z.array(
        z.object({
          field: z.enum(AUDIENCE_FIELD_KEYS),
          operator: z.enum(AUDIENCE_OPERATORS),
          value: z.union([z.string(), z.number(), z.array(z.string())]),
        }),
      ),
    }),
  ),
  explanation: z.string(),
  confidence: z.number(),
  unmatched: z.array(z.string()),
});

const StepSchema = z.object({
  type: z.enum(["email", "task", "wait", "api", "approval", "stop"]),
  templateKey: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  title: z.string().optional(),
  ownerRole: z.string().optional(),
  dueInDays: z.number().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  duration: z.number().optional(),
  unit: z.enum(["hours", "days"]).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).optional(),
  endpoint: z.string().optional(),
  approverRole: z.string().optional(),
  reason: z.string().optional(),
});

const WorkflowSchema = z.object({
  steps: z.array(
    StepSchema.extend({
      type: z.enum(["email", "task", "wait", "api", "approval", "stop", "condition"]),
      conditionLabel: z.string().optional(),
      yesSteps: z.array(StepSchema).optional(),
      noSteps: z.array(StepSchema).optional(),
    }),
  ),
  explanation: z.string(),
});

const AssistantSchema = z.object({
  answer: z.string(),
  accountIds: z.array(z.string()),
  suggestedAction: z.enum(["none", "open_outcomes", "open_audience_builder", "open_account", "open_my_work", "open_score_dashboard"]),
  suggestedAccountId: z.string().optional(),
});

const SYSTEM = `You are Zeke, an AI assistant inside a customer success platform. You turn customer-success managers' requests into structured, reviewable output. Never invent data: only use the facts and catalogues provided. A human always reviews your output before anything is executed.`;

function catalogue(context: AudienceParseContext): string {
  const fields = AUDIENCE_FIELDS.map((f) => {
    const options = f.key === "owner" ? context.owners.map((o) => `${o.id} (${o.name})`) : (f.options ?? []).map((o) => `${o.value} (${o.label})`);
    return `- ${f.key}: ${f.label}, ${f.type}${options.length ? `; values: ${options.join(", ")}` : ""}`;
  });
  return [
    "Audience fields:",
    ...fields,
    "Operators: enums use equals, notEquals, in, notIn (in/notIn take string arrays). Numbers use lessThan, greaterThan, lessThanOrEqual, greaterThanOrEqual, equals, notEquals.",
    "Day-based fields count days elapsed (lastMeetingDays, lastLoginDays) or days remaining (renewalInDays). ARR is in dollars.",
    `Lifecycle stages: ${LIFECYCLE_STAGES.join(", ")}. Segments: ${SEGMENTS.join(", ")}. Bands: ${HEALTH_BAND_ORDER.join(", ")}.`,
    "Conditions in a group are ANDed; groups are ORed.",
  ].join("\n");
}

function toStep(s: z.infer<typeof StepSchema>): AgentStepNode {
  const id = nodeId("s");
  switch (s.type) {
    case "email": {
      const d = defaultStepConfig("email");
      const templateKey = EMAIL_TEMPLATES.some((t) => t.key === s.templateKey) ? s.templateKey! : "office-hours";
      return { id, type: "email", config: { templateKey, requiresApproval: s.requiresApproval ?? d.requiresApproval } };
    }
    case "task": {
      const d = defaultStepConfig("task");
      return { id, type: "task", config: { title: s.title ?? d.title, ownerRole: s.ownerRole ?? d.ownerRole, dueInDays: Math.max(0, Math.round(s.dueInDays ?? d.dueInDays)), priority: s.priority ?? d.priority } };
    }
    case "wait":
      return { id, type: "wait", config: { duration: Math.max(1, Math.round(s.duration ?? 3)), unit: s.unit ?? "days" } };
    case "api": {
      const endpoint = s.endpoint?.startsWith("/") ? s.endpoint : "/v1/accounts/{id}/event";
      return { id, type: "api", config: { method: s.method ?? "POST", endpoint, payload: "{ }" } };
    }
    case "approval":
      return { id, type: "approval", config: { title: s.title ?? "Manager approval", approverRole: s.approverRole ?? "CS Manager" } };
    case "stop":
      return { id, type: "stop", config: { reason: s.reason ?? "" } };
  }
}

/**
 * Claude-backed provider for the open-ended NL tasks (audience parsing, workflow
 * generation, Q&A). Score explanations stay deterministic (computed from data).
 * Any refusal or error falls back to the rule-based provider.
 */
export class AnthropicAIProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly fallback = new RuleBasedAIProvider();

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  }

  private async parse<S extends z.ZodType>(schema: S, prompt: string): Promise<z.infer<S> | null> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 8000,
        system: SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(schema) },
        messages: [{ role: "user", content: prompt }],
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) return null;
      return response.parsed_output as z.infer<S>;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) logger.warn("AI provider rate limited; using rule-based fallback");
      else if (error instanceof Anthropic.APIError) logger.error("AI provider API error; using rule-based fallback", error, { status: error.status });
      else logger.error("AI provider failed; using rule-based fallback", error);
      return null;
    }
  }

  async parseAudience(prompt: string, context: AudienceParseContext): Promise<AudienceParseResult> {
    const out = await this.parse(
      AudienceParseSchema,
      `${catalogue(context)}\n\nConvert this request into audience filter groups. Put phrases you cannot map into "unmatched". Confidence is 0–1.\n\n<request>${prompt}</request>`,
    );
    if (!out) return this.fallback.parseAudience(prompt, context);
    // Keep only conditions that pass the same validation as hand-built filters.
    const dropped: string[] = [];
    const groups = out.groups
      .map((g) => ({
        conditions: g.conditions.filter((c) => {
          const ok = audienceConditionSchema.safeParse({ id: "x", ...c }).success;
          if (!ok) dropped.push(`${c.field} ${c.operator} ${JSON.stringify(c.value)}`);
          return ok;
        }) as Array<Omit<AudienceCondition, "id">>,
      }))
      .filter((g) => g.conditions.length > 0);
    const filter = normalizeFilter({ combinator: "or", groups });
    const names = Object.fromEntries(context.owners.map((o) => [o.id, o.name]));
    const described = filter.groups.flatMap((g) => g.conditions).map((c) => describeCondition(c, { ownerNames: names }));
    return {
      filter,
      explanation: described.length ? `${out.explanation} (${described.join("; ")})` : out.explanation,
      confidence: Math.max(0, Math.min(1, out.confidence)),
      unmatched: [...out.unmatched, ...dropped],
      provider: this.name,
    };
  }

  async generateAgentWorkflow(prompt: string): Promise<AgentWorkflowResult> {
    const out = await this.parse(
      WorkflowSchema,
      [
        "Design a customer-success agent workflow from the request. Step types: email (templateKey, requiresApproval), task (title, ownerRole, dueInDays, priority), wait (duration, unit), api (method, endpoint — a relative path), approval (title, approverRole), stop (reason), condition (conditionLabel as a yes/no question, yesSteps, noSteps — conditions only at the top level).",
        `Email templates: ${EMAIL_TEMPLATES.map((t) => `${t.key} (${t.name})`).join(", ")}.`,
        `<request>${prompt}</request>`,
      ].join("\n"),
    );
    if (!out) return this.fallback.generateAgentWorkflow(prompt);
    const steps: AgentStepNode[] = out.steps.map((s) => {
      if (s.type === "condition") {
        return {
          id: nodeId("s"),
          type: "condition",
          config: { mode: "manual", label: s.conditionLabel ?? "Condition met?" },
          branches: { yes: (s.yesSteps ?? []).map(toStep), no: (s.noSteps ?? []).map(toStep) },
        };
      }
      return toStep(s as z.infer<typeof StepSchema>);
    });
    return { steps, explanation: out.explanation, provider: this.name };
  }

  explainHealthScore(input: Parameters<AIProvider["explainHealthScore"]>[0]) {
    return this.fallback.explainHealthScore(input);
  }

  generateRootCause(input: Parameters<AIProvider["generateRootCause"]>[0]) {
    return this.fallback.generateRootCause(input);
  }

  recommendAction(rootCause: Parameters<AIProvider["recommendAction"]>[0]) {
    return this.fallback.recommendAction(rootCause);
  }

  summarizeAccount(input: Parameters<AIProvider["summarizeAccount"]>[0]) {
    return this.fallback.summarizeAccount(input);
  }

  async answerQuestion(question: string, context: AssistantContext): Promise<AssistantAnswer> {
    const rows = context.accounts.map(
      (a) => `${a.id}|${a.name}|${a.lifecycle}|${a.segment}|score ${a.healthScore} ${a.band}|risk ${a.predictiveRisk}|arr ${a.arr}|renew ${a.renewalInDays ?? "?"}d|meeting ${a.lastMeetingDays ?? "?"}d ago|nps ${a.nps ?? "?"}|weakest ${a.weakestSource ?? "?"}|owner ${a.ownerName ?? "?"}`,
    );
    const out = await this.parse(
      AssistantSchema,
      [
        `The user is ${context.userName}. Answer using only these accounts (id|name|lifecycle|segment|score band|predictive risk 0=high risk|ARR|renewal|last meeting|NPS|weakest source|owner):`,
        ...rows,
        `Health sources: ${HEALTH_SOURCES.map((s) => `${s.key}=${s.name}`).join(", ")}.`,
        "Keep the answer under 120 words. Distinguish observed data from your inferences. List relevant account ids (max 8). Suggest at most one navigation action.",
        `<question>${question}</question>`,
      ].join("\n"),
    );
    if (!out) return this.fallback.answerQuestion(question, context);
    const byId = new Map(context.accounts.map((a) => [a.id, a]));
    const accounts = out.accountIds
      .map((id) => byId.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .slice(0, 8)
      .map((a) => ({ id: a.id, name: a.name, detail: `Score ${a.healthScore} · ${a.lifecycle} · ${a.segment}` }));
    const accountId = out.suggestedAccountId && byId.has(out.suggestedAccountId) ? out.suggestedAccountId : accounts[0]?.id;
    const actions: Record<string, { label: string; href: string } | null> = {
      none: null,
      open_outcomes: { label: "Open Drive Outcome", href: "/outcomes" },
      open_audience_builder: { label: "Open Audience Creator", href: "/audiences/new" },
      open_my_work: { label: "Open My Work", href: "/my-work" },
      open_account: accountId ? { label: "Open account", href: `/accounts/${accountId}` } : null,
      open_score_dashboard: accountId ? { label: "Explain the score", href: `/score-dashboard?account=${accountId}` } : { label: "Open score dashboard", href: "/score-dashboard" },
    };
    return { answer: out.answer, accounts, suggestedAction: actions[out.suggestedAction] ?? null, provider: this.name };
  }
}
