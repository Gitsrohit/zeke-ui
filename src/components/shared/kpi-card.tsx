import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Secondary line under the value. */
  detail?: ReactNode;
  trend?: "up" | "down" | null;
  valueClassName?: string;
  className?: string;
}

export function KpiCard({ label, value, detail, trend, valueClassName, className }: KpiCardProps) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-surface px-[18px] py-4", className)}>
      <div className="text-label truncate !text-[11.5px]">{label}</div>
      <div className={cn("mt-1.5 truncate font-display text-[26px] leading-tight font-bold tabular sm:text-[28px]", valueClassName)}>{value}</div>
      {detail && (
        <div className={cn("mt-1 flex items-center gap-1 truncate text-xs", trend === "up" ? "text-thriving" : trend === "down" ? "text-critical" : "text-foreground-muted")}>
          {trend === "up" && <ArrowUp className="size-3 shrink-0" aria-hidden />}
          {trend === "down" && <ArrowDown className="size-3 shrink-0" aria-hidden />}
          {detail}
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-6 grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4", className)}>{children}</div>;
}
