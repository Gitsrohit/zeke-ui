"use client";

import { useMutation } from "@tanstack/react-query";
import { GitBranch, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Chip, Pill } from "@/components/shared/pill";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { AgentWorkflowResult } from "@/features/ai/types";
import { describeStepNode, STEP_TYPE_LABELS } from "@/features/agents/domain/steps";
import type { AgentStepNode } from "@/features/agents/domain/types";
import { postJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";

type Message = { role: "user"; text: string } | { role: "bot"; result: AgentWorkflowResult } | { role: "error"; text: string };

const SUGGESTIONS = [
  "Send an email, wait 3 days, then create a task for the CSM if they haven't logged in",
  "Send a re-engagement email, wait 7 days, then call the escalation API",
  "Create a task, wait 2 days, then send an email",
];

function flatten(steps: AgentStepNode[]): AgentStepNode[] {
  return steps.flatMap((s) => (s.type === "condition" ? [s, ...s.branches.yes, ...s.branches.no] : [s]));
}

/** Natural-language → workflow proposal. Nothing is applied until the user opens it in the builder, and nothing is saved until they click Save. */
export function AgentAiPanel({ hasSteps, readOnly, onApply }: { hasSteps: boolean; readOnly: boolean; onApply: (steps: AgentStepNode[]) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingApply, setPendingApply] = useState<AgentStepNode[] | null>(null);
  const generate = useMutation({
    mutationFn: (prompt: string) => postJson<AgentWorkflowResult>(API.aiAgent, { prompt }),
    onSuccess: (result) => setMessages((m) => [...m, { role: "bot", result }]),
    onError: (e) => setMessages((m) => [...m, { role: "error", text: e instanceof Error ? e.message : "Something went wrong." }]),
  });
  const send = (text: string) => {
    const t = text.trim();
    if (!t || generate.isPending) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setInput("");
    generate.mutate(t);
  };
  const apply = (steps: AgentStepNode[]) => (hasSteps ? setPendingApply(steps) : onApply(steps));

  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4" aria-live="polite">
        <div className="max-w-[85%] self-start rounded-[10px] rounded-bl-sm border border-border bg-surface-muted px-3.5 py-2.5 text-[13.5px]">
          Describe the sequence you want — for example, “Send an email, wait 3 days, then create a task for the CSM if they haven&apos;t logged in.” I&apos;ll draft the steps for you to review.
        </div>
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end rounded-[10px] rounded-br-sm bg-primary px-3.5 py-2.5 text-[13.5px] text-white">
              {m.text}
            </div>
          ) : m.role === "error" ? (
            <div key={i} role="alert" className="max-w-[85%] self-start rounded-[10px] border border-critical/30 bg-critical-tint px-3.5 py-2.5 text-[13px] text-critical">
              {m.text}
            </div>
          ) : (
            <div key={i} className="max-w-[90%] self-start rounded-[10px] rounded-bl-sm border border-border bg-surface-muted px-3.5 py-2.5 text-[13.5px]">
              <p>{m.result.explanation}</p>
              {m.result.steps.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {flatten(m.result.steps).map((s) => (
                    <Chip key={s.id}>
                      {STEP_TYPE_LABELS[s.type]}: {describeStepNode(s)}
                    </Chip>
                  ))}
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {m.result.steps.length > 0 && !readOnly && (
                  <Button size="xs" variant="accent" onClick={() => apply(m.result.steps)}>
                    <GitBranch /> Open in builder
                  </Button>
                )}
                <Pill tone="muted" className="ml-auto">
                  {m.result.provider === "anthropic" ? "Claude" : "Rule-based"}
                </Pill>
              </div>
            </div>
          ),
        )}
        {generate.isPending && (
          <span className="flex items-center gap-2 text-[12.5px] text-foreground-faint">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Drafting steps…
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" disabled={readOnly} onClick={() => send(s)} className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-violet hover:text-violet-deep disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-border bg-surface-muted p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="agent-ai-input" className="sr-only">
          Describe the sequence
        </label>
        <input
          id="agent-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={800}
          disabled={readOnly}
          placeholder={readOnly ? "You don't have permission to edit agents" : "Describe the sequence…"}
          className="h-9 flex-1 rounded-[7px] border border-border-strong bg-surface px-3 text-[13px] outline-none focus-visible:border-violet focus-visible:ring-3 focus-visible:ring-violet/20 disabled:opacity-60"
        />
        <Button type="submit" variant="accent" size="icon" className="size-9" disabled={readOnly || !input.trim() || generate.isPending} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
      <ConfirmDialog
        open={pendingApply !== null}
        onOpenChange={(o) => !o && setPendingApply(null)}
        title="Replace the current steps?"
        description="The canvas already has steps. Opening this draft replaces them. Nothing is saved until you click Save."
        confirmLabel="Replace steps"
        onConfirm={() => {
          if (pendingApply) onApply(pendingApply);
          setPendingApply(null);
        }}
      />
    </div>
  );
}
