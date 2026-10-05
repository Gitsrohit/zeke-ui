import { getEmailTemplate } from "@/config/email-templates";
import { describeCondition, evaluateCondition } from "@/features/audiences/domain/evaluate";
import type { AccountFacts } from "@/features/audiences/domain/types";
import { nodeId } from "@/features/audiences/domain/builders";
import type {
  AgentStepConfigMap,
  AgentStepNode,
  AgentStepType,
  ConditionStepConfig,
  RunStep,
  WaitStepConfig,
} from "./types";

export const STEP_TYPE_LABELS: Record<AgentStepType, string> = {
  email: "Email",
  task: "Task",
  wait: "Wait",
  condition: "Condition",
  api: "API Call",
  approval: "Approval",
  stop: "Stop",
};

export const STEP_TYPE_DESCRIPTIONS: Record<AgentStepType, string> = {
  email: "Send a templated email to the account's primary contact",
  task: "Create a task in the owner's work queue",
  wait: "Pause the sequence for a set time",
  condition: "Branch into Yes / No paths",
  api: "Call an external API endpoint",
  approval: "Wait for a manager's approval before continuing",
  stop: "End the sequence for this account",
};

/** Step types that pause the run and require a person to act. */
export function stepRequiresHuman(type: AgentStepType, config: AgentStepConfigMap[AgentStepType]): boolean {
  if (type === "task" || type === "approval") return true;
  if (type === "email") return (config as AgentStepConfigMap["email"]).requiresApproval;
  if (type === "condition") return (config as ConditionStepConfig).mode === "manual";
  return false;
}

export function describeStepNode(node: Pick<AgentStepNode, "type" | "config">): string {
  switch (node.type) {
    case "email": {
      const c = node.config as AgentStepConfigMap["email"];
      const name = getEmailTemplate(c.templateKey)?.name ?? c.templateKey;
      return `${c.requiresApproval ? "Approve & send" : "Send"} "${name}"`;
    }
    case "task": {
      const c = node.config as AgentStepConfigMap["task"];
      return `${c.title} · ${c.ownerRole} · due in ${c.dueInDays}d`;
    }
    case "wait": {
      const c = node.config as WaitStepConfig;
      return `Wait ${c.duration} ${c.duration === 1 ? c.unit.replace(/s$/, "") : c.unit}`;
    }
    case "condition": {
      const c = node.config as ConditionStepConfig;
      if (c.mode === "auto" && c.field && c.operator && c.value !== undefined) {
        return `Check: ${describeCondition({ id: "x", field: c.field, operator: c.operator, value: c.value })}`;
      }
      return `Decide: ${c.label}`;
    }
    case "api": {
      const c = node.config as AgentStepConfigMap["api"];
      return `${c.method} ${c.endpoint}`;
    }
    case "approval": {
      const c = node.config as AgentStepConfigMap["approval"];
      return `${c.title} · ${c.approverRole}`;
    }
    case "stop": {
      const c = node.config as AgentStepConfigMap["stop"];
      return c.reason ? `Stop — ${c.reason}` : "Stop the sequence";
    }
  }
}

export function defaultStepConfig<T extends AgentStepType>(type: T): AgentStepConfigMap[T] {
  const defaults: AgentStepConfigMap = {
    email: { templateKey: "welcome", requiresApproval: false },
    task: { title: "New task", ownerRole: "CSM", dueInDays: 1, priority: "medium" },
    wait: { duration: 3, unit: "days" },
    condition: { mode: "manual", label: "Customer responded?" },
    api: { method: "POST", endpoint: "/v1/accounts/{id}/event", payload: "{ }" },
    approval: { title: "Manager approval", approverRole: "CS Manager" },
    stop: { reason: "" },
  };
  return defaults[type];
}

export function createStepNode(type: AgentStepType): AgentStepNode {
  if (type === "condition") {
    return { id: nodeId("s"), type, config: defaultStepConfig("condition"), branches: { yes: [], no: [] } };
  }
  return { id: nodeId("s"), type, config: defaultStepConfig(type) } as AgentStepNode;
}

export function waitDurationMs(config: WaitStepConfig): number {
  return config.duration * (config.unit === "hours" ? 3_600_000 : 86_400_000);
}

export function countSteps(steps: readonly AgentStepNode[]): number {
  return steps.reduce((n, s) => n + 1 + (s.type === "condition" ? countSteps(s.branches.yes) + countSteps(s.branches.no) : 0), 0);
}

/** Evaluates an automatic condition against account facts. Returns null when the condition is manual or incomplete. */
export function evaluateAutoCondition(config: ConditionStepConfig, facts: AccountFacts): "yes" | "no" | null {
  if (config.mode !== "auto" || !config.field || !config.operator || config.value === undefined) return null;
  return evaluateCondition(facts, { id: "auto", field: config.field, operator: config.operator, value: config.value }) ? "yes" : "no";
}

/** Splices the chosen branch's steps into a run immediately after the resolved condition. */
export function spliceBranch(steps: readonly RunStep[], conditionIndex: number, branch: "yes" | "no"): RunStep[] {
  const condition = steps[conditionIndex];
  if (!condition || condition.type !== "condition") throw new Error("Step at index is not a condition");
  const inserted: RunStep[] = (condition.branches?.[branch] ?? []).map((node) => ({
    id: nodeId("rs"),
    position: 0,
    type: node.type,
    config: node.config,
    status: "pending",
    branches: node.type === "condition" ? node.branches : undefined,
  }));
  const next = [...steps.slice(0, conditionIndex + 1), ...inserted, ...steps.slice(conditionIndex + 1)];
  return next.map((s, i) => ({ ...s, position: i }));
}

export function validateStepTree(steps: readonly AgentStepNode[], depth = 0): string[] {
  const errors: string[] = [];
  steps.forEach((s, i) => {
    const where = `Step ${i + 1}${depth ? " (in branch)" : ""}`;
    if (s.type === "task" && !s.config.title.trim()) errors.push(`${where}: task needs a title`);
    if (s.type === "wait" && (!Number.isFinite(s.config.duration) || s.config.duration <= 0)) errors.push(`${where}: wait duration must be greater than 0`);
    if (s.type === "email" && !getEmailTemplate(s.config.templateKey)) errors.push(`${where}: choose an email template`);
    if (s.type === "api" && !s.config.endpoint.startsWith("/")) errors.push(`${where}: API endpoint must be a relative path starting with "/"`);
    if (s.type === "condition") {
      if (depth > 0) errors.push(`${where}: conditions cannot be nested inside a branch`);
      if (s.config.mode === "auto" && (!s.config.field || !s.config.operator || s.config.value === undefined || s.config.value === "")) {
        errors.push(`${where}: automatic conditions need a field, operator and value`);
      }
      if (s.config.mode === "manual" && !s.config.label.trim()) errors.push(`${where}: describe the decision`);
      errors.push(...validateStepTree(s.branches.yes, depth + 1), ...validateStepTree(s.branches.no, depth + 1));
    }
  });
  return errors;
}
