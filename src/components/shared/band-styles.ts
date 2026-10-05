import { HEALTH_BANDS, type HealthBandKey } from "@/config/health";

/** Static Tailwind classes per health band (kept literal so Tailwind can detect them). */
export const BAND_STYLES: Record<HealthBandKey, { text: string; bg: string; tint: string; border: string; color: string }> = {
  thriving: { text: "text-thriving", bg: "bg-thriving", tint: "bg-thriving-tint", border: "border-thriving", color: "var(--thriving)" },
  stable: { text: "text-stable", bg: "bg-stable", tint: "bg-stable-tint", border: "border-stable", color: "var(--stable)" },
  atRisk: { text: "text-at-risk", bg: "bg-at-risk", tint: "bg-at-risk-tint", border: "border-at-risk", color: "var(--at-risk)" },
  critical: { text: "text-critical", bg: "bg-critical", tint: "bg-critical-tint", border: "border-critical", color: "var(--critical)" },
};

export function bandLabel(band: HealthBandKey): string {
  return HEALTH_BANDS[band].label;
}
