"use client";

import Link from "next/link";
import { HealthTrendChart } from "@/components/charts/health-trend-chart";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { getHealthBand } from "@/features/health/domain/score";
import { HeatCell } from "./heat-cell";
import { formatMetric, formatMetricAxis, type MetricFormat } from "./score-helpers";

interface MetricCardProps {
  name: string;
  hint: string | null;
  format: MetricFormat;
  higherIsBetter: boolean;
  months: string[];
  raw: number[];
  p25?: number[];
  p75?: number[];
  /** 0–100 sub-measure score now. */
  score: number;
  footer: React.ReactNode;
  weakest?: Array<{ href: string; name: string; raw: number; score: number }>;
  valueSuffix?: string;
}

export function MetricCard({ name, hint, format, higherIsBetter, months, raw, p25, p75, score, footer, weakest, valueSuffix }: MetricCardProps) {
  const now = raw[raw.length - 1] ?? 0;
  const then = raw[Math.max(0, raw.length - 4)] ?? now;
  const delta = format.money ? (now - then) / 1000 : now - then;
  const color = (higherIsBetter ? now >= then : now <= then) ? "var(--thriving)" : "var(--critical)";
  return (
    <div className="rounded-lg border border-border bg-surface-muted px-3 pt-3 pb-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold">{name}</div>
          {hint && <div className="text-[10.5px] text-foreground-faint">{hint}</div>}
        </div>
        <HeatCell value={score} />
      </div>
      <div className="mt-1 mb-0.5 flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[19px] font-bold tabular">{formatMetric(format, now)}</span>
        <TrendIndicator delta={delta} higherIsBetter={higherIsBetter} suffix={format.money ? "k" : ""} flatLabel="flat" />
        <span className="text-[11px] text-foreground-faint">{valueSuffix ?? "vs. 3 months ago"}</span>
      </div>
      <HealthTrendChart labels={months} values={raw} p25={p25} p75={p75} height={92} color={color} valueLabel={name} format={(v) => formatMetricAxis(format, v)} />
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-foreground-faint">{footer}</div>
      {weakest && weakest.length > 0 && (
        <div className="mt-2 border-t border-dashed border-border pt-1.5">
          <div className="text-label !text-[10px]">Weakest accounts</div>
          {weakest.map((w) => (
            <Link key={w.href} href={w.href} scroll={false} className="-mx-1 flex justify-between gap-2 rounded px-1 py-0.5 text-[11.5px] text-foreground-muted hover:bg-violet-tint hover:text-primary">
              <span className="truncate">{w.name}</span>
              <b className={`font-mono ${BAND_STYLES[getHealthBand(Math.round(w.score))].text}`}>{formatMetric(format, w.raw)}</b>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
