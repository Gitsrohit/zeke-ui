"use client";

import type { ReactNode } from "react";

export interface TooltipRow {
  color?: string;
  label: string;
  value: ReactNode;
}

export function ChartTooltipBox({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-[150px] rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="mb-1 font-semibold text-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5 text-foreground-muted">
          {r.color && <span aria-hidden className="size-2 rounded-full" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <b className="font-mono text-foreground">{r.value}</b>
        </div>
      ))}
    </div>
  );
}
