import { Pill } from "@/components/shared/pill";
import type { AgentRunOutcome, AgentRunStatus, RunStepStatus } from "@/features/agents/domain/types";

const RUN_TONE: Record<AgentRunStatus, "violet" | "thriving" | "muted" | "critical"> = { active: "violet", completed: "thriving", stopped: "muted", failed: "critical" };
const RUN_LABEL: Record<AgentRunStatus, string> = { active: "Active", completed: "Completed", stopped: "Stopped", failed: "Failed" };

export function RunStatusPill({ status }: { status: AgentRunStatus }) {
  return (
    <Pill tone={RUN_TONE[status]} dot>
      {RUN_LABEL[status]}
    </Pill>
  );
}

const OUTCOME: Record<AgentRunOutcome, { label: string; tone: "thriving" | "stable" | "muted" | "atRisk" }> = {
  resolved: { label: "Resolved", tone: "thriving" },
  improved: { label: "Improved", tone: "stable" },
  no_change: { label: "No change", tone: "muted" },
  declined: { label: "Declined", tone: "atRisk" },
  stopped: { label: "Stopped", tone: "muted" },
};

export function OutcomePill({ outcome }: { outcome: AgentRunOutcome | null }) {
  if (!outcome) return <span className="text-xs text-foreground-faint">—</span>;
  return <Pill tone={OUTCOME[outcome].tone}>{OUTCOME[outcome].label}</Pill>;
}

const STEP_TONE: Record<RunStepStatus, { label: string; tone: "muted" | "violet" | "stable" | "thriving" | "critical" }> = {
  pending: { label: "Pending", tone: "muted" },
  active: { label: "Waiting on a person", tone: "violet" },
  waiting: { label: "Waiting", tone: "stable" },
  completed: { label: "Completed", tone: "thriving" },
  skipped: { label: "Skipped", tone: "muted" },
  failed: { label: "Failed", tone: "critical" },
};

export function StepStatusPill({ status }: { status: RunStepStatus }) {
  return (
    <Pill tone={STEP_TONE[status].tone} dot>
      {STEP_TONE[status].label}
    </Pill>
  );
}

/** Signed lift rendered with text (+/−), not colour alone. */
export function Lift({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const rounded = Number(value.toFixed(decimals));
  const text = `${rounded > 0 ? "+" : rounded < 0 ? "−" : "±"}${Math.abs(rounded).toFixed(decimals)}${suffix}`;
  return <span className={rounded > 0 ? "text-thriving" : rounded < 0 ? "text-critical" : "text-foreground-faint"}>{text}</span>;
}
