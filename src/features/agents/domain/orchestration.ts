/**
 * Orchestration rules: decide whether an account may be enrolled in an agent.
 * Pure functions — the agent service loads the inputs and enforces the result.
 */

export interface OrchestrationAgent {
  id: string;
  name: string;
  /** Agents this one conflicts with (symmetric — include both directions). */
  conflictsWith: readonly string[];
  cooldownDays: number;
  maxAttempts: number | null;
  eligibleLifecycles: readonly string[];
}

export interface OrchestrationRun {
  agentId: string;
  agentName: string;
  status: "active" | "completed" | "stopped" | "failed";
  completedAt: Date | null;
}

export interface OrchestrationAccount {
  id: string;
  name: string;
  status: "active" | "churned";
  lifecycle: string;
}

export type BlockCode = "duplicate" | "conflict" | "cooldown" | "max_attempts" | "ineligible_status" | "ineligible_lifecycle";

export interface LaunchBlock {
  code: BlockCode;
  reason: string;
}

const DAY_MS = 86_400_000;

export function checkAgentConflict(agent: OrchestrationAgent, runs: readonly OrchestrationRun[]): LaunchBlock | null {
  const active = runs.filter((r) => r.status === "active");
  if (active.some((r) => r.agentId === agent.id)) {
    return { code: "duplicate", reason: `already active in "${agent.name}"` };
  }
  const conflicting = active.find((r) => agent.conflictsWith.includes(r.agentId));
  if (conflicting) {
    return { code: "conflict", reason: `already active in "${conflicting.agentName}" (conflicting agent)` };
  }
  return null;
}

export function checkAgentCooldown(agent: OrchestrationAgent, runs: readonly OrchestrationRun[], now: Date = new Date()): LaunchBlock | null {
  if (agent.cooldownDays <= 0) return null;
  const recent = runs
    .filter((r) => r.agentId === agent.id && r.status === "completed" && r.completedAt)
    .map((r) => r.completedAt as Date)
    .filter((completedAt) => now.getTime() - completedAt.getTime() < agent.cooldownDays * DAY_MS)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!recent) return null;
  const daysLeft = Math.ceil((recent.getTime() + agent.cooldownDays * DAY_MS - now.getTime()) / DAY_MS);
  return {
    code: "cooldown",
    reason: `completed "${agent.name}" recently — in cooldown for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}`,
  };
}

export function checkAgentEligibility(
  agent: OrchestrationAgent,
  account: OrchestrationAccount,
  runs: readonly OrchestrationRun[],
): LaunchBlock | null {
  if (account.status !== "active") {
    return { code: "ineligible_status", reason: "not an active customer" };
  }
  if (agent.eligibleLifecycles.length > 0 && !agent.eligibleLifecycles.includes(account.lifecycle)) {
    return { code: "ineligible_lifecycle", reason: `in ${account.lifecycle}, but "${agent.name}" only runs for ${agent.eligibleLifecycles.join(", ")}` };
  }
  if (agent.maxAttempts !== null) {
    const attempts = runs.filter((r) => r.agentId === agent.id).length;
    if (attempts >= agent.maxAttempts) {
      return { code: "max_attempts", reason: `has reached the maximum of ${agent.maxAttempts} run${agent.maxAttempts === 1 ? "" : "s"} for "${agent.name}"` };
    }
  }
  return null;
}

/** Runs every rule in priority order and returns the first block, or null if the account may be enrolled. */
export function evaluateLaunch(
  agent: OrchestrationAgent,
  account: OrchestrationAccount,
  runs: readonly OrchestrationRun[],
  now: Date = new Date(),
): LaunchBlock | null {
  return checkAgentEligibility(agent, account, runs) ?? checkAgentConflict(agent, runs) ?? checkAgentCooldown(agent, runs, now);
}

export interface LaunchPlan<A extends OrchestrationAccount> {
  eligible: A[];
  skipped: Array<{ account: A; block: LaunchBlock }>;
}

export function planLaunch<A extends OrchestrationAccount>(
  agent: OrchestrationAgent,
  accounts: readonly A[],
  runsByAccount: ReadonlyMap<string, readonly OrchestrationRun[]>,
  now: Date = new Date(),
): LaunchPlan<A> {
  const plan: LaunchPlan<A> = { eligible: [], skipped: [] };
  for (const account of accounts) {
    const block = evaluateLaunch(agent, account, runsByAccount.get(account.id) ?? [], now);
    if (block) plan.skipped.push({ account, block });
    else plan.eligible.push(account);
  }
  return plan;
}
