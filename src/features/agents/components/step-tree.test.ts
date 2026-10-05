import { describe, expect, it } from "vitest";
import type { AgentStepNode } from "@/features/agents/domain/types";
import { findStep, stepTreeReducer } from "./step-tree";

const task = (id: string): AgentStepNode => ({ id, type: "task", config: { title: id, ownerRole: "CSM", dueInDays: 1, priority: "medium" } });
const cond = (id: string, yes: AgentStepNode[] = [], no: AgentStepNode[] = []): AgentStepNode => ({ id, type: "condition", config: { mode: "manual", label: "Q?" }, branches: { yes, no } });

const ids = (steps: AgentStepNode[]) => steps.map((s) => s.id);

describe("stepTreeReducer", () => {
  it("inserts at a root index", () => {
    const out = stepTreeReducer([task("a"), task("c")], { type: "insert", address: { kind: "root" }, index: 1, node: task("b") });
    expect(ids(out)).toEqual(["a", "b", "c"]);
  });

  it("inserts into a condition branch", () => {
    const out = stepTreeReducer([cond("c1")], { type: "insert", address: { kind: "branch", conditionId: "c1", branch: "no" }, index: 0, node: task("n") });
    const c = out[0];
    expect(c.type === "condition" && ids(c.branches.no)).toEqual(["n"]);
    expect(c.type === "condition" && c.branches.yes).toEqual([]);
  });

  it("refuses to nest conditions inside branches", () => {
    const steps = [cond("c1")];
    expect(stepTreeReducer(steps, { type: "insert", address: { kind: "branch", conditionId: "c1", branch: "yes" }, index: 0, node: cond("c2") })).toBe(steps);
  });

  it("removes steps anywhere in the tree", () => {
    const out = stepTreeReducer([task("a"), cond("c1", [task("y")], [task("n")])], { type: "remove", id: "y" });
    expect(findStep(out, "y")).toBeNull();
    expect(findStep(out, "n")).not.toBeNull();
    expect(ids(stepTreeReducer(out, { type: "remove", id: "c1" }))).toEqual(["a"]);
  });

  it("updates config by id", () => {
    const out = stepTreeReducer([cond("c1", [task("y")])], { type: "updateConfig", id: "y", config: { title: "New", ownerRole: "AM", dueInDays: 3, priority: "high" } });
    const y = findStep(out, "y");
    expect(y?.type === "task" && y.config.title).toBe("New");
  });

  it("moves steps within their own list and clamps at the ends", () => {
    const steps = [task("a"), task("b"), task("c")];
    expect(ids(stepTreeReducer(steps, { type: "move", id: "c", direction: "up" }))).toEqual(["a", "c", "b"]);
    expect(ids(stepTreeReducer(steps, { type: "move", id: "a", direction: "up" }))).toEqual(["a", "b", "c"]);
    const branchy = [cond("c1", [task("y1"), task("y2")])];
    const moved = stepTreeReducer(branchy, { type: "move", id: "y2", direction: "up" });
    expect(moved[0].type === "condition" && ids(moved[0].branches.yes)).toEqual(["y2", "y1"]);
  });

  it("replaces the whole tree", () => {
    expect(ids(stepTreeReducer([task("a")], { type: "replace", steps: [task("z")] }))).toEqual(["z"]);
  });
});
