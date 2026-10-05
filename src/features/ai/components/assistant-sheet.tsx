"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { postJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { AssistantAnswer } from "../types";

type Message = { role: "user"; text: string } | { role: "assistant"; answer: AssistantAnswer } | { role: "error"; text: string };

const SUGGESTIONS = ["Which accounts are at risk?", "Who renews in the next 90 days?", "Where are our expansion opportunities?", "Enterprise accounts in Adoption with health score below 60"];

export function AssistantSheet() {
  const open = useUiStore((s) => s.assistantOpen);
  const prompt = useUiStore((s) => s.assistantPrompt);
  const close = useUiStore((s) => s.closeAssistant);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const lastPrompt = useRef<string | null>(null);

  const ask = useMutation({
    mutationFn: (question: string) => postJson<AssistantAnswer>(API.aiAssistant, { question }),
    onSuccess: (answer) => setMessages((m) => [...m, { role: "assistant", answer }]),
    onError: (error) => setMessages((m) => [...m, { role: "error", text: error instanceof Error ? error.message : "Something went wrong." }]),
  });

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    ask.mutate(q);
  };

  useEffect(() => {
    if (open && prompt && prompt !== lastPrompt.current) {
      lastPrompt.current = prompt;
      send(prompt);
    }
    if (!open) lastPrompt.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when a new prompt arrives
  }, [open, prompt]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, ask.isPending]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="max-w-[min(480px,100vw)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet" aria-hidden /> Ask Zeke
          </SheetTitle>
          <SheetDescription>Answers come from your account data. Zeke suggests next steps — it never takes actions on its own.</SheetDescription>
        </SheetHeader>
        <div ref={logRef} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[22px] py-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="rounded-lg border border-border bg-surface-muted p-3.5 text-[13px] text-foreground-muted">
              Ask about health, risk, renewals or expansion — or describe an audience in plain language.
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[85%] self-end rounded-[10px] rounded-br-sm bg-primary px-3.5 py-2.5 text-[13.5px] text-white">
                {m.text}
              </div>
            ) : m.role === "error" ? (
              <div key={i} role="alert" className="max-w-[90%] self-start rounded-[10px] border border-critical/30 bg-critical-tint px-3.5 py-2.5 text-[13px] text-critical">
                {m.text}
              </div>
            ) : (
              <div key={i} className="max-w-[92%] self-start rounded-[10px] rounded-bl-sm border border-border bg-surface-muted px-3.5 py-2.5 text-[13.5px]">
                <p className="whitespace-pre-line">{m.answer.answer}</p>
                {m.answer.accounts.length > 0 && (
                  <ul className="mt-2.5 divide-y divide-border rounded-md border border-border bg-surface">
                    {m.answer.accounts.map((a) => (
                      <li key={a.id}>
                        <Link href={`/accounts/${a.id}`} onClick={close} className="flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-violet-tint/50">
                          <span className="font-semibold">{a.name}</span>
                          <span className="ml-auto truncate text-[11.5px] text-foreground-faint">{a.detail}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {m.answer.suggestedAction && (
                    <Button asChild size="xs" variant="accent">
                      <Link href={m.answer.suggestedAction.href} onClick={close}>
                        {m.answer.suggestedAction.label} <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  <Pill tone="muted" className="ml-auto" title="Which AI provider produced this answer">
                    {m.answer.provider === "anthropic" ? "Claude" : "Rule-based"}
                  </Pill>
                </div>
              </div>
            ),
          )}
          {ask.isPending && (
            <div className="flex items-center gap-2 self-start text-[12.5px] text-foreground-faint">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Thinking…
            </div>
          )}
        </div>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 px-[22px] pb-3">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-violet hover:text-violet-deep">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2 border-t border-border bg-surface-muted p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="assistant-input" className="sr-only">
            Ask Zeke a question
          </label>
          <input
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder="Ask about your customers…"
            className="h-9 flex-1 rounded-[7px] border border-border-strong bg-surface px-3 text-[13px] outline-none focus-visible:border-violet focus-visible:ring-3 focus-visible:ring-violet/20"
          />
          <Button type="submit" variant="accent" size="icon" className={cn("size-9")} disabled={!input.trim() || ask.isPending} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
