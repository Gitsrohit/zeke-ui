import type { AgentRunOutcome, AgentRunStatus } from "./types";

export interface RunPerformanceInput {
  status: AgentRunStatus;
  metricAtLaunch: number;
  scoreAtLaunch: number;
  /** Current value of the agent's target metric for the account. */
  metricNow: number;
  scoreNow: number;
}

export interface RunLift {
  metricLift: number;
  scoreLift: number;
}

export function calculateRunLift(run: RunPerformanceInput): RunLift {
  return { metricLift: run.metricNow - run.metricAtLaunch, scoreLift: run.scoreNow - run.scoreAtLaunch };
}

/** Outcome of a completed run based on the movement of its target metric. */
export function classifyOutcome(metricLift: number): Extract<AgentRunOutcome, "resolved" | "improved" | "no_change"> {
  if (metricLift >= 8) return "resolved";
  if (metricLift > 0) return "improved";
  return "no_change";
}

export interface AgentLiftSummary {
  totalRuns: number;
  completedRuns: number;
  activeRuns: number;
  failedRuns: number;
  completionRate: number;
  failureRate: number;
  /** Share of runs whose target metric improved. */
  successRate: number;
  positiveLiftCount: number;
  avgMetricLift: number;
  avgScoreLift: number;
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/**
 * Lift is computed live: the current metric value minus the value captured at
 * launch, so analytics always reflect real customer data rather than stored outcomes.
 */
export function calculateAgentLift(runs: readonly RunPerformanceInput[]): AgentLiftSummary {
  const lifts = runs.map(calculateRunLift);
  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed" || r.status === "stopped").length;
  const positive = lifts.filter((l) => l.metricLift > 0).length;
  return {
    totalRuns: runs.length,
    completedRuns: completed,
    activeRuns: runs.filter((r) => r.status === "active").length,
    failedRuns: failed,
    completionRate: pct(completed, runs.length),
    failureRate: pct(failed, runs.length),
    successRate: pct(positive, runs.length),
    positiveLiftCount: positive,
    avgMetricLift: average(lifts.map((l) => l.metricLift)),
    avgScoreLift: average(lifts.map((l) => l.scoreLift)),
  };
}
