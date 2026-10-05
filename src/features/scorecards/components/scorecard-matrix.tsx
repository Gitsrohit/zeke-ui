import Link from "next/link";
import { HEALTH_BAND_ORDER, HEALTH_BANDS, LIFECYCLE_STAGES, SEGMENTS } from "@/config/health";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { HealthBadge } from "@/components/shared/health-badge";
import { Pill } from "@/components/shared/pill";
import type { getScorecardMatrix } from "@/features/scorecards/services/scorecard.service";
import { cn } from "@/lib/utils";

type MatrixItem = Awaited<ReturnType<typeof getScorecardMatrix>>[number];

function ScorecardCard({ sc }: { sc: MatrixItem }) {
  const band = sc.averageBand;
  return (
    <Link
      href={`/scorecards/${sc.id}`}
      className="block rounded-lg border border-border bg-surface px-4 py-3.5 transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-pop focus-visible:shadow-pop"
      aria-label={`${sc.lifecycle} · ${sc.segment} scorecard: ${sc.accountCount} accounts, average ${sc.averageScore ?? "no score"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-foreground-faint">
          {sc.accountCount} account{sc.accountCount === 1 ? "" : "s"}
        </span>
        {band ? <HealthBadge band={band} /> : <Pill tone="muted">No accounts</Pill>}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-foreground-muted lg:hidden">
        {sc.lifecycle} · {sc.segment}
      </div>
      <div className={cn("mt-2 font-mono text-[26px] font-bold tabular", band ? BAND_STYLES[band].text : "text-foreground-faint")}>{sc.averageScore ?? "—"}</div>
      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span>avg health score</span>
        <span className="font-mono text-[10.5px] text-foreground-faint">v{sc.version}</span>
      </div>
      <div className="mt-3 flex h-1.5 gap-[2px] overflow-hidden rounded bg-border" aria-hidden>
        {HEALTH_BAND_ORDER.map((b) =>
          sc.bands[b] ? <span key={b} className={cn("h-full", BAND_STYLES[b].bg)} style={{ width: `${(sc.bands[b] / Math.max(1, sc.accountCount)) * 100}%` }} /> : null,
        )}
      </div>
      <p className="sr-only">{HEALTH_BAND_ORDER.map((b) => `${HEALTH_BANDS[b].label}: ${sc.bands[b]}`).join(", ")}</p>
    </Link>
  );
}

/** Lifecycle × segment grid; collapses to a stacked list on small screens. */
export function ScorecardMatrix({ items }: { items: MatrixItem[] }) {
  const find = (l: string, s: string) => items.find((i) => i.lifecycle === l && i.segment === s);
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[110px_repeat(3,minmax(0,1fr))]">
      <div className="hidden lg:block" />
      {SEGMENTS.map((s) => (
        <div key={s} className="text-label hidden self-end px-1 pb-1 lg:block">
          {s}
        </div>
      ))}
      {LIFECYCLE_STAGES.map((l) => (
        <div key={l} className="contents">
          <div className="col-span-full flex items-center px-0.5 pt-2 font-display text-[13.5px] font-semibold text-primary lg:col-span-1 lg:pt-0">{l}</div>
          {SEGMENTS.map((s) => {
            const sc = find(l, s);
            return sc ? <ScorecardCard key={s} sc={sc} /> : <div key={s} className="rounded-lg border border-dashed border-border p-4 text-xs text-foreground-faint">No scorecard</div>;
          })}
        </div>
      ))}
    </div>
  );
}
