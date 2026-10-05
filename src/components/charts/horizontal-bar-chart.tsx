"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { resolveFormat, type ValueFormat } from "./value-format";
import { ChartFrame } from "./chart-frame";
import { ChartTooltipBox } from "./chart-tooltip";
import { CHART_INK } from "./palette";

interface Row {
  label: string;
  value: number;
  color?: string;
  detail?: string;
}

/** Diverging-capable horizontal bars (e.g. agent metric lift). */
export function HorizontalBarChart({ rows, label, title, subtitle, format: formatProp, valueLabel = "Value" }: { rows: Row[]; label: string; title?: string; subtitle?: string; format?: ((v: number) => string) | ValueFormat; valueLabel?: string }) {
  const format = resolveFormat(formatProp, (v) => v.toFixed(1));
  const height = Math.max(120, rows.length * 34 + 30);
  return (
    <ChartFrame title={title} subtitle={subtitle} label={label} table={{ columns: [{ key: "label", label: "Item" }, { key: "value", label: valueLabel }], rows: rows.map((r) => ({ label: r.label, value: format(r.value) })) }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_INK.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: CHART_INK.axis, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => format(v)} />
          <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11.5, fill: CHART_INK.muted }} tickLine={false} axisLine={false} />
          <ReferenceLine x={0} stroke={CHART_INK.axis} />
          <Bar dataKey="value" maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fontSize: 11, fill: CHART_INK.text, formatter: (v: unknown) => format(Number(v)) }}>
            {rows.map((r) => (
              <Cell key={r.label} fill={r.color ?? (r.value >= 0 ? "var(--thriving)" : "var(--critical)")} />
            ))}
          </Bar>
          <Tooltip
            cursor={{ fill: "rgb(19 26 43 / 0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as Row;
              return <ChartTooltipBox title={r.label} rows={[{ label: valueLabel, value: format(r.value) }, ...(r.detail ? [{ label: "Detail", value: r.detail }] : [])]} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
