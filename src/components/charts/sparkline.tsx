import { cn } from "@/lib/utils";

/** Tiny inline trend line (no axes). Decorative — pair with a numeric value. */
export function Sparkline({ values, width = 120, height = 30, className, color }: { values: number[]; width?: number; height?: number; className?: string; color?: string }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1e-6, hi - lo);
  const pts = values.map((v, i) => [2 + (i * (width - 4)) / (values.length - 1), height - 3 - ((v - lo) / span) * (height - 6)]);
  const stroke = color ?? (values[values.length - 1] >= values[0] ? "var(--thriving)" : "var(--critical)");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("block overflow-visible", className)} aria-hidden>
      <polyline points={pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={stroke} stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
