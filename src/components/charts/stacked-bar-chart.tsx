"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { resolveFormat, type ValueFormat } from "./value-format";
import { ChartFrame, LegendItem } from "./chart-frame";
import { ChartTooltipBox } from "./chart-tooltip";
import { CHART_INK } from "./palette";

export interface StackSeries {
  key: string;
  label: string;
  color: string;
}

interface StackedBarChartProps {
  data: Array<Record<string, string | number>>;
  categoryKey: string;
  series: StackSeries[];
  label: string;
  title?: string;
  subtitle?: string;
  height?: number;
  format?: ((v: number) => string) | ValueFormat;
}

/** Monthly stacked columns (band mix, renewal ARR). One axis, 2px surface gaps between segments. */
export function StackedBarChart({ data, categoryKey, series, label, title, subtitle, height = 180, format: formatProp }: StackedBarChartProps) {
  const format = resolveFormat(formatProp, (v) => String(v));
  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      label={label}
      table={{ columns: [{ key: categoryKey, label: "Period" }, ...series.map((s) => ({ key: s.key, label: s.label }))], rows: data.map((d) => Object.fromEntries([[categoryKey, d[categoryKey]], ...series.map((s) => [s.key, format(Number(d[s.key] ?? 0))])])) }}
      legend={
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <LegendItem key={s.key} color={s.color} label={s.label} />
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis dataKey={categoryKey} tick={{ fontSize: 10, fill: CHART_INK.axis, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={{ stroke: CHART_INK.grid }} minTickGap={10} />
          <YAxis tick={{ fontSize: 10, fill: CHART_INK.axis, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => format(v)} width={52} allowDecimals={false} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="stack" fill={s.color} maxBarSize={24} stroke="var(--surface)" strokeWidth={1} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
          ))}
          <Tooltip
            cursor={{ fill: "rgb(19 26 43 / 0.04)" }}
            content={({ active, payload, label: l }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number>;
              return <ChartTooltipBox title={l} rows={[...series].reverse().map((s) => ({ color: s.color, label: s.label, value: format(Number(row[s.key] ?? 0)) }))} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
