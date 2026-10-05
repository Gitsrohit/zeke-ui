"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AGENT_STEP_TYPES, type AgentStepNode, type AgentStepType } from "@/features/agents/domain/types";
import { describeStepNode, STEP_TYPE_DESCRIPTIONS, STEP_TYPE_LABELS } from "@/features/agents/domain/steps";
import { cn } from "@/lib/utils";
import type { StepListAddress } from "./step-tree";
import { StepIcon } from "./step-style";

interface FlowCanvasProps {
  steps: AgentStepNode[];
  selectedId: string | null;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: (address: StepListAddress, index: number, type: AgentStepType) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

function Connector() {
  return <div aria-hidden className="ml-[29px] h-[18px] w-0.5 bg-border-strong" />;
}

function AddStepButton({ address, index, allowCondition, onAdd }: { address: StepListAddress; index: number; allowCondition: boolean; onAdd: FlowCanvasProps["onAdd"] }) {
  const types = AGENT_STEP_TYPES.filter((t) => allowCondition || t !== "condition");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group my-0.5 ml-[15px] flex items-center gap-2 rounded-md py-0.5 pr-2 text-foreground-faint outline-none hover:text-violet-deep focus-visible:ring-2 focus-visible:ring-violet">
        <span className="flex size-7 items-center justify-center rounded-full border-[1.5px] border-dashed border-border-strong group-hover:border-solid group-hover:border-violet group-hover:bg-violet-tint">
          <Plus className="size-3.5" aria-hidden />
        </span>
        <span className="text-xs font-semibold">Add step</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-label">Insert step</DropdownMenuLabel>
        {types.map((t) => (
          <DropdownMenuItem key={t} onSelect={() => onAdd(address, index, t)} className="items-start gap-2.5 py-2">
            <StepIcon type={t} size="sm" />
            <span>
              <span className="block text-[12.5px] font-semibold">{STEP_TYPE_LABELS[t]}</span>
              <span className="block text-[11px] text-foreground-faint">{STEP_TYPE_DESCRIPTIONS[t]}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FlowNode({ node, index, count, props }: { node: AgentStepNode; index: number; count: number; props: FlowCanvasProps }) {
  const selected = props.selectedId === node.id;
  const subtitle = describeStepNode(node);
  return (
    <div className={cn("group/node flex items-center gap-2.5 rounded-lg border bg-surface px-3 py-2.5 transition-shadow", selected ? "border-violet shadow-[0_0_0_3px_var(--violet-tint)]" : "border-border-strong")}>
      <button type="button" onClick={() => props.onSelect(node.id)} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:underline">
        <StepIcon type={node.type} />
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold">{STEP_TYPE_LABELS[node.type]}</span>
          <span className="block truncate text-[11.5px] text-foreground-faint" title={subtitle}>
            {subtitle}
          </span>
        </span>
      </button>
      {!props.readOnly && (
        <span className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-focus-within/node:opacity-100 sm:group-hover/node:opacity-100">
          <button type="button" className="rounded p-1 text-foreground-faint hover:text-foreground disabled:opacity-30" disabled={index === 0} onClick={() => props.onMove(node.id, "up")} aria-label={`Move ${STEP_TYPE_LABELS[node.type]} step up`}>
            <ArrowUp className="size-3.5" />
          </button>
          <button type="button" className="rounded p-1 text-foreground-faint hover:text-foreground disabled:opacity-30" disabled={index === count - 1} onClick={() => props.onMove(node.id, "down")} aria-label={`Move ${STEP_TYPE_LABELS[node.type]} step down`}>
            <ArrowDown className="size-3.5" />
          </button>
          <button type="button" className="rounded p-1 text-foreground-faint hover:text-critical" onClick={() => props.onRemove(node.id)} aria-label={`Delete ${STEP_TYPE_LABELS[node.type]} step`}>
            <X className="size-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}

function StepList({ steps, address, allowCondition, props }: { steps: AgentStepNode[]; address: StepListAddress; allowCondition: boolean; props: FlowCanvasProps }) {
  const add = (index: number) => (props.readOnly ? null : <AddStepButton address={address} index={index} allowCondition={allowCondition} onAdd={props.onAdd} />);
  return (
    <ol className="flex flex-col">
      <li aria-hidden={props.readOnly || undefined}>{add(0)}</li>
      {steps.map((node, i) => (
        <li key={node.id}>
          <Connector />
          <FlowNode node={node} index={i} count={steps.length} props={props} />
          {node.type === "condition" && (
            <div className="mt-1.5 ml-[15px] grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-2">
              {(["yes", "no"] as const).map((branch) => (
                <div key={branch} className="min-w-0">
                  <span className={cn("mb-1 inline-block rounded px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-wide uppercase", branch === "yes" ? "bg-thriving-tint text-thriving" : "bg-critical-tint text-critical")}>
                    If {branch}
                  </span>
                  <StepList steps={node.branches[branch]} address={{ kind: "branch", conditionId: node.id, branch }} allowCondition={false} props={props} />
                  {node.branches[branch].length === 0 && props.readOnly && <p className="text-[11.5px] text-foreground-faint">No steps — the run continues.</p>}
                </div>
              ))}
            </div>
          )}
          {!props.readOnly && <Connector />}
          {add(i + 1)}
        </li>
      ))}
    </ol>
  );
}

/** Visual workflow canvas. Pure React — the tree is owned by the builder's reducer. */
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <div className="max-w-[520px]" aria-label="Workflow steps">
      <StepList steps={props.steps} address={{ kind: "root" }} allowCondition props={props} />
      {props.steps.length === 0 && <p className="mt-2 ml-[15px] text-[12.5px] text-foreground-faint">No steps yet. Add the first step, or describe the sequence in “Ask Zeke”.</p>}
    </div>
  );
}
