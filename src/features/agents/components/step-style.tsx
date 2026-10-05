import { CheckCircle2, Clock, GitBranch, Mail, ListTodo, OctagonX, Zap, type LucideIcon } from "lucide-react";
import type { AgentStepType } from "@/features/agents/domain/types";
import { cn } from "@/lib/utils";

/** Per-step-type icon tile colours (kept literal for Tailwind). */
export const STEP_STYLE: Record<AgentStepType, { icon: LucideIcon; tile: string }> = {
  email: { icon: Mail, tile: "bg-violet-tint text-violet-deep" },
  task: { icon: ListTodo, tile: "bg-primary-tint text-primary" },
  wait: { icon: Clock, tile: "bg-stable-tint text-stable" },
  condition: { icon: GitBranch, tile: "bg-[#edeafb] text-[#5b45c4]" },
  api: { icon: Zap, tile: "bg-critical-tint text-critical" },
  approval: { icon: CheckCircle2, tile: "bg-thriving-tint text-thriving" },
  stop: { icon: OctagonX, tile: "bg-surface-muted text-foreground-muted ring-1 ring-border ring-inset" },
};

export function StepIcon({ type, size = "md" }: { type: AgentStepType; size?: "sm" | "md" }) {
  const { icon: Icon, tile } = STEP_STYLE[type];
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-[7px]", tile, size === "md" ? "size-[30px]" : "size-6 rounded-md")}>
      <Icon className={size === "md" ? "size-[15px]" : "size-[13px]"} />
    </span>
  );
}
