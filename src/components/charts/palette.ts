import { HEALTH_SOURCE_KEYS, type HealthSourceKey } from "@/config/health";

/**
 * Validated categorical palette (passes lightness, chroma, CVD and normal-vision
 * checks; sub-3:1 slots are always paired with visible labels or a table view).
 * Assigned to health sources in a fixed order — colour follows the source, never its rank.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"] as const;

export const SOURCE_COLORS: Record<HealthSourceKey, string> = Object.fromEntries(
  HEALTH_SOURCE_KEYS.map((key, i) => [key, SERIES_COLORS[i]]),
) as Record<HealthSourceKey, string>;

export const CHART_INK = {
  grid: "#e9ebef",
  axis: "#646d80",
  text: "#131a2b",
  muted: "#4b5568",
  surface: "#ffffff",
  primary: "#6d3fc4",
} as const;
