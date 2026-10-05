import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const pillVariants = cva("inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[3px] font-mono text-[11px] font-semibold tracking-[0.01em]", {
  variants: {
    tone: {
      neutral: "bg-primary-tint text-primary",
      thriving: "bg-thriving-tint text-thriving",
      stable: "bg-stable-tint text-stable",
      atRisk: "bg-at-risk-tint text-at-risk",
      critical: "bg-critical-tint text-critical",
      muted: "bg-surface-muted text-foreground-muted ring-1 ring-border ring-inset",
      violet: "bg-violet-tint text-violet-deep",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface PillProps extends React.ComponentProps<"span">, VariantProps<typeof pillVariants> {
  dot?: boolean;
}

export function Pill({ className, tone, dot, children, ...props }: PillProps) {
  return (
    <span className={cn(pillVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Compact mono chip used to echo filters and step summaries. */
export function Chip({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full bg-violet-tint px-[9px] py-[3px] font-mono text-[11px] font-semibold text-violet-deep", className)} {...props} />;
}
