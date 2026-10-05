import type { HealthBandKey } from "@/config/health";
import { cn } from "@/lib/utils";
import { BAND_STYLES, bandLabel } from "./band-styles";

export function ScoreGauge({ score, band, size = 120, className }: { score: number; band: HealthBandKey; size?: number; className?: string }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const style = BAND_STYLES[band];
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`Health score ${score} out of 100, ${bandLabel(band)}`}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={style.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-display leading-none font-bold tabular", style.text)} style={{ fontSize: size / 4 }}>
          {score}
        </span>
        <span className="mt-0.5 text-[10.5px] tracking-[0.04em] text-foreground-faint uppercase">{bandLabel(band)}</span>
      </div>
    </div>
  );
}
