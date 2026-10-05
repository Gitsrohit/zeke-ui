import type { AudienceFieldKey, AudienceOperator, AudienceConditionValue } from "@/features/audiences/domain/types";

export const AGENT_STEP_TYPES = ["email", "task", "wait", "condition", "api", "approval", "stop"] as const;
export type AgentStepType = (typeof AGENT_STEP_TYPES)[number];

export const AGENT_CATEGORIES = ["Onboarding", "Adoption", "Growth", "Renewal", "Escalation"] as const;
export type AgentCategory = (typeof AGENT_CATEGORIES)[number];

export const AGENT_TRIGGER_TYPES = ["manual", "audience", "event"] as const;
export type AgentTriggerType = (typeof AGENT_TRIGGER_TYPES)[number];

export interface EmailStepConfig {
  templateKey: string;
  /** When true the email waits in My Work for approval instead of sending automatically. */
  requiresApproval: boolean;
}

export interface TaskStepConfig {
  title: string;
  ownerRole: string;
  dueInDays: number;
  priority: "low" | "medium" | "high";
}

export interface WaitStepConfig {
  duration: number;
  unit: "hours" | "days";
}

/**
 * Manual conditions become a decision in My Work. Automatic conditions are
 * evaluated against the account's current facts using the audience field catalogue.
 */
export interface ConditionStepConfig {
  mode: "manual" | "auto";
  label: string;
  field?: AudienceFieldKey;
  operator?: AudienceOperator;
  value?: AudienceConditionValue;
}

export interface ApiStepConfig {
  method: "GET" | "POST" | "PUT" | "PATCH";
  endpoint: string;
  payload: string;
}

export interface ApprovalStepConfig {
  title: string;
  approverRole: string;
}

export interface StopStepConfig {
  reason: string;
}

export interface AgentStepConfigMap {
  email: EmailStepConfig;
  task: TaskStepConfig;
  wait: WaitStepConfig;
  condition: ConditionStepConfig;
  api: ApiStepConfig;
  approval: ApprovalStepConfig;
  stop: StopStepConfig;
}

export type AgentStepConfig = AgentStepConfigMap[AgentStepType];

interface StepNodeBase<T extends AgentStepType> {
  id: string;
  type: T;
  config: AgentStepConfigMap[T];
}

export type ConditionStepNode = StepNodeBase<"condition"> & {
  branches: { yes: AgentStepNode[]; no: AgentStepNode[] };
};

/** Tree representation of an agent's workflow used by the builder and versioning. */
export type AgentStepNode =
  | StepNodeBase<"email">
  | StepNodeBase<"task">
  | StepNodeBase<"wait">
  | ConditionStepNode
  | StepNodeBase<"api">
  | StepNodeBase<"approval">
  | StepNodeBase<"stop">;

export type RunStepStatus = "pending" | "active" | "waiting" | "completed" | "skipped" | "failed";
export type AgentRunStatus = "active" | "completed" | "stopped" | "failed";
export type AgentRunOutcome = "resolved" | "improved" | "no_change" | "declined" | "stopped";

/** A materialised step inside a run (linear; branches are spliced in when resolved). */
export interface RunStep {
  id: string;
  position: number;
  type: AgentStepType;
  config: AgentStepConfig;
  status: RunStepStatus;
  /** The branches of the source agent step (only for conditions), used to splice on resolution. */
  branches?: { yes: AgentStepNode[]; no: AgentStepNode[] };
}
