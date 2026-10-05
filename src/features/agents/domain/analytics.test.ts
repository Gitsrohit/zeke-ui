import { describe, expect, it } from "vitest";
import { calculateAgentLift, calculateRunLift, classifyOutcome } from "./analytics";
import { countSteps, evaluateAutoCondition, spliceBranch, stepRequiresHuman, validateStepTree } from "./steps";
import type { AgentStepNode, RunStep } from "./types";
import type { AccountFacts } from "@/features/audiences/domain/types";

describe("calculateAgentLift", () => {
  it("computes lift live from metric at launch vs current", () => {
    expect(calculateRunLift({ status: "completed", metricAtLaunch: 40, scoreAtLaunch: 55, metricNow: 52, scoreNow: 58 })).toEqual({ metricLift: 12, scoreLift: 3 });
  });

  it("summarises completion, success and failure rates", () => {
    const summary = calculateAgentLift([
      { status: "completed", metricAtLaunch: 40, scoreAtLaunch: 50, metricNow: 50, scoreNow: 54 },
      { status: "completed", metricAtLaunch: 60, scoreAtLaunch: 70, metricNow: 55, scoreNow: 68 },
      { status: "active", metricAtLaunch: 30, scoreAtLaunch: 45, metricNow: 36, scoreNow: 47 },
      { status: "stopped", metricAtLaunch: 50, scoreAtLaunch: 50, metricNow: 50, scoreNow: 50 },
    ]);
    expect(summary).toMatchObject({
      totalRuns: 4,
      completedRuns: 2,
      activeRuns: 1,
      failedRuns: 1,
      completionRate: 50,
      failureRate: 25,
      successRate: 50,
      positiveLiftCount: 2,
    });
    expect(summary.avgMetricLift).toBeCloseTo((10 - 5 + 6 + 0) / 4);
    expect(summary.avgScoreLift).toBeCloseTo((4 - 2 + 2 + 0) / 4);
  });

  it("handles no runs", () => {
    expect(calculateAgentLift([])).toMatchObject({ totalRuns: 0, completionRate: 0, avgMetricLift: 0 });
  });

  it("classifies outcomes by metric lift", () => {
    expect(classifyOutcome(12)).toBe("resolved");
    expect(classifyOutcome(3)).toBe("improved");
    expect(classifyOutcome(0)).toBe("no_change");
    expect(classifyOutcome(-4)).toBe("no_change");
  });
});

describe("agent steps", () => {
  const condition: AgentStepNode = {
    id: "c1",
    type: "condition",
    config: { mode: "manual", label: "Usage recovered?" },
    branches: {
      yes: [{ id: "y1", type: "task", config: { title: "Close CTA", ownerRole: "CSM", dueInDays: 1, priority: "low" } }],
      no: [
        { id: "n1", type: "api", config: { method: "POST", endpoint: "/v1/escalate", payload: "{}" } },
        { id: "n2", type: "stop", config: { reason: "escalated" } },
      ],
    },
  };

  it("identifies steps that need a person", () => {
    expect(stepRequiresHuman("task", { title: "x", ownerRole: "CSM", dueInDays: 1, priority: "low" })).toBe(true);
    expect(stepRequiresHuman("email", { templateKey: "welcome", requiresApproval: false })).toBe(false);
    expect(stepRequiresHuman("email", { templateKey: "welcome", requiresApproval: true })).toBe(true);
    expect(stepRequiresHuman("condition", { mode: "auto", label: "", field: "healthScore", operator: "lessThan", value: 60 })).toBe(false);
    expect(stepRequiresHuman("wait", { duration: 1, unit: "days" })).toBe(false);
  });

  it("splices the chosen branch after the condition and renumbers positions", () => {
    const steps: RunStep[] = [
      { id: "r0", position: 0, type: "email", config: { templateKey: "welcome", requiresApproval: false }, status: "completed" },
      { id: "r1", position: 1, type: "condition", config: condition.config, status: "active", branches: condition.type === "condition" ? condition.branches : undefined },
      { id: "r2", position: 2, type: "task", config: { title: "Wrap up", ownerRole: "CSM", dueInDays: 1, priority: "low" }, status: "pending" },
    ];
    const no = spliceBranch(steps, 1, "no");
    expect(no.map((s) => s.type)).toEqual(["email", "condition", "api", "stop", "task"]);
    expect(no.map((s) => s.position)).toEqual([0, 1, 2, 3, 4]);
    expect(spliceBranch(steps, 1, "yes").map((s) => s.type)).toEqual(["email", "condition", "task", "task"]);
    expect(() => spliceBranch(steps, 0, "yes")).toThrow();
  });

  it("counts nested steps", () => {
    expect(countSteps([condition])).toBe(4);
  });

  it("evaluates automatic conditions against account facts", () => {
    const facts = { healthScore: 45 } as AccountFacts;
    expect(evaluateAutoCondition({ mode: "auto", label: "", field: "healthScore", operator: "lessThan", value: 60 }, facts)).toBe("yes");
    expect(evaluateAutoCondition({ mode: "auto", label: "", field: "healthScore", operator: "greaterThan", value: 60 }, facts)).toBe("no");
    expect(evaluateAutoCondition({ mode: "manual", label: "Q?" }, facts)).toBeNull();
  });

  it("validates step trees", () => {
    expect(validateStepTree([condition])).toEqual([]);
    const nested: AgentStepNode = { ...condition, branches: { yes: [condition], no: [] } } as AgentStepNode;
    expect(validateStepTree([nested]).join()).toContain("cannot be nested");
    expect(validateStepTree([{ id: "w", type: "wait", config: { duration: 0, unit: "days" } }]).join()).toContain("greater than 0");
    expect(validateStepTree([{ id: "a", type: "api", config: { method: "GET", endpoint: "https://evil.example", payload: "" } }]).join()).toContain("relative path");
  });
});
