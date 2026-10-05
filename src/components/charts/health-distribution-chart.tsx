"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { HEALTH_BANDS, type HealthBandKey } from "@/config/health";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { formatCurrency } from "@/lib/utils/format";
import { ChartFrame, LegendItem } from "./chart-frame";
import { ChartTooltipBox } from "./chart-tooltip";

export function HealthDistributionChart({ data }: { data: Array<{ band: HealthBandKey; count: number; arr: number }> }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const rows = data.map((d) => ({ name: HEALTH_BANDS[d.band].label, value: d.count, arr: d.arr, color: BAND_STYLES[d.band].color, band: d.band }));
  return (
    <ChartFrame
      label={`Health distribution across ${total} accounts: ${rows.map((r) => `${r.name} ${r.value}`).join(", ")}`}
      table={{ columns: [{ key: "name", label: "Band" }, { key: "value", label: "Accounts" }, { key: "arr", label: "ARR" }], rows: rows.map((r) => ({ name: r.name, value: r.value, arr: formatCurrency(r.arr) })) }}
      className="flex flex-col items-center gap-4 sm:flex-row sm:items-center"
      legend={
        <div className="grid w-full flex-1 gap-2">
          {rows.map((r) => (
            <div key={r.band} className="flex items-center gap-3 rounded-md bg-surface-muted px-3 py-2">
              <LegendItem color={r.color} label={r.name} />
              <span className="ml-auto font-mono text-[13px] font-semibold tabular">{r.value}</span>
              <span className="w-12 text-right font-mono text-[11.5px] text-foreground-faint tabular">{total ? Math.round((r.value / total) * 100) : 0}%</span>
              <span className="hidden w-14 text-right font-mono text-[11.5px] text-foreground-faint tabular sm:inline">{formatCurrency(r.arr)}</span>
            </div>
          ))}
        </div>
      }
    >
      <div className="relative size-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.band} fill={r.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return <ChartTooltipBox title={r.name} rows={[{ color: r.color, label: "Accounts", value: r.value }, { label: "ARR", value: formatCurrency(r.arr) }]} />;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular">{total}</span>
          <span className="text-[10.5px] tracking-wide text-foreground-faint uppercase">accounts</span>
        </div>
      </div>
    </ChartFrame>
  );
}
