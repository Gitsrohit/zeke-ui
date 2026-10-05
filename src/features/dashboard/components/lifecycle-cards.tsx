import { HEALTH_BAND_ORDER, type HealthBandKey } from "@/config/health";
import { BAND_STYLES, bandLabel } from "@/components/shared/band-styles";
import { getHealthBand } from "@/features/health/domain/score";
import { cn } from "@/lib/utils";

export function DistributionBar({ bands, total, className }: { bands: Record<HealthBandKey, number>; total: number; className?: string }) {
  return (
    <div className={cn("flex h-1.5 gap-[2px] overflow-hidden rounded bg-border", className)} role="img" aria-label={HEALTH_BAND_ORDER.map((b) => `${bandLabel(b)} ${bands[b]}`).join(", ")}>
      {HEALTH_BAND_ORDER.map((b) => (bands[b] ? <span key={b} className={cn("h-full", BAND_STYLES[b].bg)} style={{ width: `${(bands[b] / Math.max(1, total)) * 100}%` }} /> : null))}
    </div>
  );
}

export function LifecycleCards({ items }: { items: Array<{ lifecycle: string; count: number; averageScore: number; bands: Record<HealthBandKey, number> }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((l) => {
        const band = getHealthBand(l.averageScore);
        return (
          <div key={l.lifecycle} className="rounded-lg border border-border bg-surface px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-display text-[13.5px] font-semibold">{l.lifecycle}</span>
              <span className="shrink-0 font-mono text-xs whitespace-nowrap text-foreground-faint">{l.count} accts</span>
            </div>
            <div className={cn("mt-1.5 font-mono text-[22px] font-bold tabular", l.count ? BAND_STYLES[band].text : "text-foreground-faint")}>{l.count ? l.averageScore : "—"}</div>
            <div className="mb-2.5 text-[11px] text-foreground-faint">avg health · {l.count ? bandLabel(band) : "no accounts"}</div>
            <DistributionBar bands={l.bands} total={l.count} />
          </div>
        );
      })}
    </div>
  );
}
