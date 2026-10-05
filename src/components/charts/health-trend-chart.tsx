"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HEALTH_BANDS, type BandThresholds } from "@/config/health";
import { resolveFormat, type ValueFormat } from "./value-format";
import { ChartFrame } from "./chart-frame";
import { ChartTooltipBox } from "./chart-tooltip";
import { CHART_INK } from "./palette";

interface HealthTrendChartProps {
  labels: string[];
  values: number[];
  /** Optional interquartile band (portfolio views). */
  p25?: number[];
  p75?: number[];
  thresholds?: BandThresholds;
  color?: string;
  height?: number;
  title?: string;
  subtitle?: string;
  domain?: [number, number];
  valueLabel?: string;
  format?: ((v: number) => string) | ValueFormat;
}

export function HealthTrendChart({ labels, values, p25, p75, thresholds, color = CHART_INK.primary, height = 180, title, subtitle, domain, valueLabel = "Score", format: formatProp }: HealthTrendChartProps) {
  const format = resolveFormat(formatProp, (v) => String(Math.round(v)));
  const data = labels.map((label, i) => ({ label, value: Number(values[i]?.toFixed(1)), range: p25 && p75 ? [p25[i], p75[i]] : undefined }));
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      label={`${title ?? valueLabel} over ${labels.length} months: from ${format(first)} in ${labels[0]} to ${format(last)} in ${labels[labels.length - 1]}`}
      table={{ columns: [{ key: "label", label: "Month" }, { key: "value", label: valueLabel }], rows: data.map((d) => ({ label: d.label, value: format(d.value) })) }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_INK.axis, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={{ stroke: CHART_INK.grid }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis domain={domain ?? ["auto", "auto"]} tick={{ fontSize: 10, fill: CHART_INK.axis, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => format(v)} width={48} />
          {thresholds &&
            (["thriving", "stable", "atRisk"] as const).map((k) => (
              <ReferenceLine key={k} y={thresholds[k]} stroke={CHART_INK.grid} strokeWidth={1} label={{ value: `${HEALTH_BANDS[k].label} ${thresholds[k]}`, position: "insideTopRight", fontSize: 9.5, fill: CHART_INK.axis }} />
            ))}
          {p25 && p75 && <Area dataKey="range" stroke="none" fill={color} fillOpacity={0.1} isAnimationActive={false} />}
          {!p25 && <Area dataKey="value" stroke="none" fill={color} fillOpacity={0.08} isAnimationActive={false} />}
          <Line dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: CHART_INK.surface, strokeWidth: 2 }} isAnimationActive={false} />
          <Tooltip
            cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as (typeof data)[number];
              return (
                <ChartTooltipBox
                  title={label}
                  rows={[
                    { color, label: valueLabel, value: format(point.value) },
                    ...(point.range ? [{ label: "Middle 50%", value: `${format(point.range[0])}–${format(point.range[1])}` }] : []),
                  ]}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
