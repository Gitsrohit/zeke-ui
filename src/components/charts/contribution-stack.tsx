import { getHealthSource, type HealthSourceKey } from "@/config/health";
import { cn } from "@/lib/utils";
import { LegendItem } from "./chart-frame";
import { SOURCE_COLORS } from "./palette";

interface Contribution {
  source: HealthSourceKey;
  points: number;
  pointsLost: number;
  normalizedWeight: number;
}

/** "How the score is built": each source's weighted points, plus the hatched gap of points lost. */
export function ContributionStack({ contributions, className, showLost = false }: { contributions: Contribution[]; className?: string; showLost?: boolean }) {
  const total = contributions.reduce((s, c) => s + c.points, 0);
  return (
    <figure className={cn("min-w-0", className)}>
      <div className="flex h-[22px] gap-[2px] overflow-hidden rounded-md bg-border" role="img" aria-label={`Score ${Math.round(total)} built from: ${contributions.map((c) => `${getHealthSource(c.source).name} ${c.points.toFixed(1)} points`).join(", ")}`}>
        {contributions.map((c) => (
          <span key={c.source} title={`${getHealthSource(c.source).name}: ${c.points.toFixed(1)} pts`} style={{ width: `${c.points}%`, background: SOURCE_COLORS[c.source] }} className="block h-full" />
        ))}
        <span className="block h-full flex-1 bg-[repeating-linear-gradient(135deg,var(--border)_0_5px,var(--surface-muted)_5px_10px)]" title={`Points lost: ${(100 - total).toFixed(1)}`} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {contributions.map((c) => (
          <div key={c.source} className="flex items-center gap-2">
            <LegendItem color={SOURCE_COLORS[c.source]} label={getHealthSource(c.source).name} value={c.points.toFixed(1)} />
            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-foreground-faint">{showLost ? `−${c.pointsLost.toFixed(1)}` : `of ${c.normalizedWeight.toFixed(0)}`}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
