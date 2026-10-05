import type { AgentStepConfig, AgentStepNode } from "@/features/agents/domain/types";

/** Where a step list lives: the root of the workflow, or one branch of a condition. */
export type StepListAddress = { kind: "root" } | { kind: "branch"; conditionId: string; branch: "yes" | "no" };

export type StepTreeAction =
  | { type: "replace"; steps: AgentStepNode[] }
  | { type: "insert"; address: StepListAddress; index: number; node: AgentStepNode }
  | { type: "remove"; id: string }
  | { type: "updateConfig"; id: string; config: AgentStepConfig }
  | { type: "move"; id: string; direction: "up" | "down" };

function mapLists(steps: AgentStepNode[], fn: (list: AgentStepNode[], address: StepListAddress) => AgentStepNode[]): AgentStepNode[] {
  const root = fn(steps, { kind: "root" });
  return root.map((s) =>
    s.type === "condition"
      ? {
          ...s,
          branches: {
            yes: fn(s.branches.yes, { kind: "branch", conditionId: s.id, branch: "yes" }),
            no: fn(s.branches.no, { kind: "branch", conditionId: s.id, branch: "no" }),
          },
        }
      : s,
  );
}

function sameAddress(a: StepListAddress, b: StepListAddress): boolean {
  if (a.kind === "root" || b.kind === "root") return a.kind === b.kind;
  return a.conditionId === b.conditionId && a.branch === b.branch;
}

export function findStep(steps: AgentStepNode[], id: string): AgentStepNode | null {
  for (const s of steps) {
    if (s.id === id) return s;
    if (s.type === "condition") {
      const found = [...s.branches.yes, ...s.branches.no].find((b) => b.id === id);
      if (found) return found;
    }
  }
  return null;
}

/** Pure reducer for the builder's step tree. Conditions may only live at the root. */
export function stepTreeReducer(steps: AgentStepNode[], action: StepTreeAction): AgentStepNode[] {
  switch (action.type) {
    case "replace":
      return action.steps;
    case "insert": {
      if (action.node.type === "condition" && action.address.kind !== "root") return steps;
      return mapLists(steps, (list, address) => {
        if (!sameAddress(address, action.address)) return list;
        const index = Math.max(0, Math.min(action.index, list.length));
        return [...list.slice(0, index), action.node, ...list.slice(index)];
      });
    }
    case "remove":
      return mapLists(steps, (list) => list.filter((s) => s.id !== action.id));
    case "updateConfig":
      return mapLists(steps, (list) => list.map((s) => (s.id === action.id ? ({ ...s, config: action.config } as AgentStepNode) : s)));
    case "move":
      return mapLists(steps, (list) => {
        const i = list.findIndex((s) => s.id === action.id);
        if (i < 0) return list;
        const j = action.direction === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return list;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
  }
}
