import { getHealthBand } from "@/features/health/domain/score";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { cn } from "@/lib/utils";

/** Score chip tinted by band (default thresholds). The number is always shown, so colour is never the only cue. */
export function HeatCell({ value, className }: { value: number; className?: string }) {
  const s = BAND_STYLES[getHealthBand(Math.round(value))];
  return <span className={cn("inline-flex h-[22px] min-w-8 items-center justify-center rounded-[5px] px-1.5 font-mono text-[11.5px] font-bold tabular", s.tint, s.text, className)}>{Math.round(value)}</span>;
}
