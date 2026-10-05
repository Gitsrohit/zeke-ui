import { Eye, Lightbulb, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/** Separates what we observed from what the model infers and what it suggests — recommendations are never presented as fact. */
export function InsightBlock({ observed, inference, action }: { observed: ReactNode; inference: ReactNode; action: ReactNode }) {
  const rows = [
    { icon: Eye, label: "Observed signal", body: observed, tone: "text-foreground" },
    { icon: Sparkles, label: "AI inference", body: inference, tone: "text-foreground-muted italic" },
    { icon: Lightbulb, label: "Recommended action", body: action, tone: "text-foreground" },
  ];
  return (
    <dl className="mt-2.5 grid gap-2 rounded-md border border-border bg-surface p-3 text-[12.5px] md:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <dt className="text-label mb-0.5 flex items-center gap-1.5 !text-[10.5px]">
            <r.icon className="size-3" aria-hidden /> {r.label}
          </dt>
          <dd className={r.tone}>{r.body}</dd>
        </div>
      ))}
    </dl>
  );
}
