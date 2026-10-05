import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  delta: number;
  /** When false, a decrease is good (e.g. days since last login). */
  higherIsBetter?: boolean;
  suffix?: string;
  className?: string;
  flatLabel?: string;
}

export function TrendIndicator({ delta, higherIsBetter = true, suffix = "", className, flatLabel = "steady" }: TrendIndicatorProps) {
  const rounded = Math.abs(delta) >= 10 ? Math.round(Math.abs(delta)) : Number(Math.abs(delta).toFixed(1));
  if (Math.abs(delta) <= 1) {
    return (
      <span className={cn("inline-flex items-center gap-[3px] font-mono text-xs text-foreground-faint", className)}>
        <Minus className="size-3" aria-hidden />
        {flatLabel}
      </span>
    );
  }
  const up = delta > 0;
  const good = higherIsBetter ? up : !up;
  return (
    <span className={cn("inline-flex items-center gap-[3px] font-mono text-xs tabular", good ? "text-thriving" : "text-critical", className)}>
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      <span className="sr-only">{up ? "up" : "down"} </span>
      {rounded}
      {suffix}
    </span>
  );
}
