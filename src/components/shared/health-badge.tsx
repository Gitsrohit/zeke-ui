import type { HealthBandKey } from "@/config/health";
import { cn } from "@/lib/utils";
import { BAND_STYLES, bandLabel } from "./band-styles";
import { Pill } from "./pill";

/** Band pill — always pairs colour with a text label (never colour alone). */
export function HealthBadge({ band, className }: { band: HealthBandKey; className?: string }) {
  return (
    <Pill tone={band} dot className={className}>
      {bandLabel(band)}
    </Pill>
  );
}

/** Numeric score chip tinted by band. */
export function ScoreBadge({ score, band, size = "md", className }: { score: number; band: HealthBandKey; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = BAND_STYLES[band];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-mono font-bold tabular",
        s.tint,
        s.text,
        size === "sm" && "h-5 min-w-[30px] px-1 text-[11px]",
        size === "md" && "h-[26px] min-w-[38px] px-1.5 text-[13px]",
        size === "lg" && "h-11 min-w-11 rounded-[10px] px-2 text-[17px]",
        className,
      )}
      aria-label={`Health score ${score} (${bandLabel(band)})`}
    >
      {score}
    </span>
  );
}
