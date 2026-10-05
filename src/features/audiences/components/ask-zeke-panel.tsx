"use client";

import { useMutation } from "@tanstack/react-query";
import { Pencil, Play, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Chip, Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import type { AudienceParseResult } from "@/features/ai/types";
import { describeCondition, flattenConditions } from "@/features/audiences/domain/evaluate";
import type { AudienceFilter } from "@/features/audiences/domain/types";
import { postJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import type { MatchedAccount, OwnerOption } from "./types";

type ParseResponse = AudienceParseResult & { preview: { count: number; total: number; accounts: MatchedAccount[] } };

type ChatMessage = { id: number; role: "user"; text: string } | { id: number; role: "bot"; result: ParseResponse } | { id: number; role: "error"; text: string };

const SUGGESTIONS = [
  "Enterprise accounts in Adoption with health score below 60 who haven't had a meeting in 30 days",
  "SMB accounts renewing in the next 90 days",
  "Onboarding customers below 50 health score",
  "Detractors with more than 3 open tickets",
];

function confidenceLabel(c: number): { label: string; tone: "thriving" | "stable" | "atRisk" } {
  if (c >= 0.75) return { label: "High confidence", tone: "thriving" };
  if (c >= 0.5) return { label: "Medium confidence", tone: "stable" };
  return { label: "Low confidence", tone: "atRisk" };
}

interface AskZekePanelProps {
  owners: OwnerOption[];
  initialPrompt?: string;
  canLaunch: boolean;
  onReview: (filter: AudienceFilter) => void;
  onLaunch: (accountIds: string[]) => void;
}

export function AskZekePanel({ owners, initialPrompt, canLaunch, onReview, onLaunch }: AskZekePanelProps) {
  const [input, setInput] = useState(initialPrompt ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const ownerNames = Object.fromEntries(owners.map((o) => [o.id, o.name]));
  const parse = useMutation({
    mutationFn: (prompt: string) => postJson<ParseResponse>(API.aiAudience, { prompt }),
    onSuccess: (result) => setMessages((m) => [...m, { id: Date.now(), role: "bot", result }]),
    onError: (e) => setMessages((m) => [...m, { id: Date.now(), role: "error", text: e instanceof Error ? e.message : "Something went wrong." }]),
  });

  const send = (text: string) => {
    const prompt = text.trim();
    if (prompt.length < 3 || parse.isPending) return;
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: prompt }]);
    setInput("");
    parse.mutate(prompt);
  };

  return (
    <div className="flex h-[min(560px,70dvh)] flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex-1 space-y-3.5 overflow-y-auto p-[18px]" aria-live="polite">
        <div className="max-w-[85%] rounded-[10px] rounded-bl-sm border border-border bg-surface-muted px-3.5 py-2.5 text-[13.5px]">
          Tell me who you want to reach — for example, &ldquo;Enterprise accounts in Adoption with health score below 60 who haven&rsquo;t had a meeting in 30 days.&rdquo;
        </div>
        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="ml-auto max-w-[85%] rounded-[10px] rounded-br-sm bg-primary px-3.5 py-2.5 text-[13.5px] text-white">
                {m.text}
              </div>
            );
          }
          if (m.role === "error") {
            return (
              <div key={m.id} role="alert" className="max-w-[85%] rounded-[10px] border border-critical/30 bg-critical-tint px-3.5 py-2.5 text-[13px] text-critical">
                {m.text}
              </div>
            );
          }
          const r = m.result;
          const conditions = flattenConditions(r.filter);
          const conf = confidenceLabel(r.confidence);
          return (
            <div key={m.id} className="max-w-[92%] rounded-[10px] rounded-bl-sm border border-border bg-surface-muted px-3.5 py-3 text-[13.5px]">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-violet-deep uppercase">
                <Sparkles className="size-3.5" aria-hidden /> AI-generated filters — review before saving or launching
              </p>
              <p>{r.explanation}</p>
              {conditions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {conditions.map((c) => (
                    <Chip key={c.id}>{describeCondition(c, { ownerNames })}</Chip>
                  ))}
                </div>
              )}
              {r.unmatched.length > 0 && <p className="mt-2 text-[12px] text-at-risk">I couldn&rsquo;t map: {r.unmatched.join("; ")}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12.5px]">
                  Matches <b>{r.preview.count}</b> of {r.preview.total} accounts
                </span>
                <Pill tone={conf.tone}>{conf.label}</Pill>
                <Pill tone="muted">{r.provider === "anthropic" ? "Claude" : "Rule-based"}</Pill>
              </div>
              {conditions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onReview(r.filter)}>
                    <Pencil /> Review & edit filters
                  </Button>
                  {canLaunch && (
                    <Button size="sm" variant="accent" onClick={() => onLaunch(r.preview.accounts.map((a) => a.id))} disabled={r.preview.count === 0}>
                      <Play /> Launch agent
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {parse.isPending && <p className="text-[12.5px] text-foreground-faint">Zeke is reading your request…</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 px-[18px] pb-3">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} disabled={parse.isPending} className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-left text-xs text-foreground-muted transition-colors hover:border-violet hover:text-violet-deep disabled:opacity-50">
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
        <label htmlFor="ask-zeke-audience" className="sr-only">
          Describe the audience you want
        </label>
        <input
          id="ask-zeke-audience"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Describe the audience you want…"
          className="h-9 flex-1 rounded-[7px] border border-border-strong bg-surface px-3 text-[13px] outline-none focus-visible:border-violet focus-visible:ring-3 focus-visible:ring-violet/20"
        />
        <Button type="submit" variant="accent" size="icon" className="size-9" disabled={input.trim().length < 3 || parse.isPending} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
