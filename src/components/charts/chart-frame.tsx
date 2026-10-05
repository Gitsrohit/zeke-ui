import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartTableColumn {
  key: string;
  label: string;
}

interface ChartFrameProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Accessible summary of what the chart shows. */
  label: string;
  /** Screen-reader data table — every chart has one so nothing is conveyed by the graphic alone. */
  table?: { columns: ChartTableColumn[]; rows: Array<Record<string, string | number>> };
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartFrame({ title, subtitle, label, table, legend, className, children }: ChartFrameProps) {
  return (
    <figure className={cn("min-w-0", className)}>
      {(title || subtitle) && (
        <figcaption className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {title && <span className="text-xs font-semibold text-foreground-muted">{title}</span>}
          {subtitle && <span className="text-[11.5px] text-foreground-faint">{subtitle}</span>}
        </figcaption>
      )}
      <div role="img" aria-label={label}>
        {children}
      </div>
      {legend}
      {table && (
        <table className="sr-only">
          <caption>{label}</caption>
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {table.columns.map((c) => (
                  <td key={c.key}>{r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

export function LegendItem({ color, label, value, square = true }: { color: string; label: string; value?: ReactNode; square?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted">
      <span aria-hidden className={cn("size-2.5 shrink-0", square ? "rounded-[3px]" : "rounded-full")} style={{ background: color }} />
      <span className="truncate">{label}</span>
      {value !== undefined && <b className="ml-auto pl-1 font-mono font-semibold text-foreground">{value}</b>}
    </span>
  );
}
