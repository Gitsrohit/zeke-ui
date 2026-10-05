"use client";

import { Building2, Filter, Gauge, GitMerge, SearchX, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HEALTH_BAND_ORDER, HEALTH_BANDS, HEALTH_SOURCES, LIFECYCLE_STAGES, SEGMENTS, type HealthBandKey, type HealthSourceKey } from "@/config/health";
import { LegendItem } from "@/components/charts/chart-frame";
import { HealthTrendChart } from "@/components/charts/health-trend-chart";
import { SOURCE_COLORS } from "@/components/charts/palette";
import { Sparkline } from "@/components/charts/sparkline";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreBadge } from "@/components/shared/health-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionTitle } from "@/components/shared/section-title";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { Button } from "@/components/ui/button";
import { getHealthBand } from "@/features/health/domain/score";
import type { ScorePortfolio } from "@/features/health/services/score-dashboard.service";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { HeatCell } from "./heat-cell";
import { MetricCard } from "./metric-card";
import { portfolioInsights, scoreHref, threeMonthDelta } from "./score-helpers";

export type GroupKey = "lifecycle" | "segment" | "owner" | "band";
const GROUPS: Array<[GroupKey, string]> = [
  ["lifecycle", "Stage"],
  ["segment", "Segment"],
  ["owner", "CSM"],
  ["band", "Health band"],
];

interface PortfolioViewProps {
  data: ScorePortfolio;
  params: Record<string, string>;
  group: GroupKey;
  owners: Array<{ id: string; name: string }>;
}

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

export function PortfolioView({ data, params, group, owners }: PortfolioViewProps) {
  const router = useRouter();
  if (data.items.length === 0) {
    return (
      <Card>
        <EmptyState icon={SearchX} title="No accounts match" description="Remove a filter or try a different search." />
      </Card>
    );
  }
  const n = data.items.length;
  const avgNow = data.overall[data.overall.length - 1] ?? 0;
  const avgDelta = threeMonthDelta(data.overall);
  const avgBand = getHealthBand(Math.round(avgNow));
  const byLost = [...data.sources].sort((a, b) => b.pointsLost - a.pointsLost);
  const insights = portfolioInsights(data);
  const showAll = params.source === "all";
  const focusKey: HealthSourceKey = (data.focus[0] ?? byLost[0].key) as HealthSourceKey;
  const panels = showAll ? data.sources : data.sources.filter((s) => s.key === focusKey);
  const sort = params.sort ?? "score";

  const groupValue = (i: ScorePortfolio["items"][number]) => (group === "band" ? HEALTH_BANDS[i.band].label : group === "owner" ? (i.ownerName ?? "Unassigned") : group === "lifecycle" ? i.lifecycle : i.segment);
  const order = group === "lifecycle" ? [...LIFECYCLE_STAGES] : group === "segment" ? [...SEGMENTS] : group === "band" ? HEALTH_BAND_ORDER.map((b) => HEALTH_BANDS[b].label) : [...new Set(data.items.map(groupValue))].sort();
  const groupRows = order
    .map((k) => ({ key: k, items: data.items.filter((i) => groupValue(i) === k) }))
    .filter((g) => g.items.length > 0);
  const groupFilter = (key: string): Record<string, string | null> => {
    if (group === "lifecycle") return { stage: key };
    if (group === "segment") return { segment: key };
    if (group === "band") return { band: HEALTH_BAND_ORDER.find((b) => HEALTH_BANDS[b].label === key) ?? null };
    return { csm: owners.find((o) => o.name === key)?.id ?? null };
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Accounts in view" value={n} detail={`${formatCurrency(data.totalArr)} ARR covered`} />
        <KpiCard label="Average health" value={Math.round(avgNow)} valueClassName={BAND_STYLES[avgBand].text} trend={avgDelta >= 0 ? "up" : "down"} detail={`${Math.abs(avgDelta).toFixed(1)} pts in 3 months`} />
        <KpiCard label="At risk / critical" value={data.riskCount} valueClassName="text-at-risk" detail={`${formatCurrency(data.riskArr)} ARR exposed`} />
        <KpiCard label="Declining fast" value={data.decliningFast} valueClassName="text-critical" detail="dropped >5 pts in 3 months" />
        <KpiCard label="Weakest source" value={<span className="text-[18px]">{byLost[0].name}</span>} detail={`avg ${Math.round(byLost[0].now)} · costs ${byLost[0].pointsLost.toFixed(1)} pts`} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card className="px-[18px] py-4">
          <HealthTrendChart
            title="Average health, last 12 months"
            subtitle="shaded = middle 50% of accounts"
            labels={data.months}
            values={data.overall}
            p25={data.overallP25}
            p75={data.overallP75}
            color={BAND_STYLES[avgBand].color}
            valueLabel="Average health"
          />
        </Card>
        <Card className="px-[18px] py-4">
          <StackedBarChart
            title="Health band mix by month"
            subtitle="number of accounts in each band"
            label={`Accounts per health band by month. This month: ${HEALTH_BAND_ORDER.map((b) => `${HEALTH_BANDS[b].label} ${data.bandMix[data.bandMix.length - 1][b]}`).join(", ")}`}
            categoryKey="month"
            data={data.months.map((m, i) => ({ month: m, ...data.bandMix[i] }))}
            series={[...HEALTH_BAND_ORDER].reverse().map((b: HealthBandKey) => ({ key: b, label: HEALTH_BANDS[b].label, color: BAND_STYLES[b].color }))}
          />
        </Card>
      </div>

      <SectionTitle icon={GitMerge} hint="average points each source adds, using each account's own scorecard weights">
        Where the average score comes from
      </SectionTitle>
      <Card className="px-[18px] py-4">
        <div className="flex h-[22px] gap-[2px] overflow-hidden rounded-md" role="img" aria-label={`Average score built from: ${data.sources.map((s) => `${s.name} ${s.pointsGained.toFixed(1)} points`).join(", ")}`}>
          {data.sources.map((s) => (
            <span key={s.key} className="block h-full" style={{ width: `${s.pointsGained}%`, background: SOURCE_COLORS[s.key] }} title={`${s.name}: ${s.pointsGained.toFixed(1)} pts`} />
          ))}
          <span className="block h-full flex-1 bg-[repeating-linear-gradient(135deg,var(--border)_0_5px,var(--surface-muted)_5px_10px)]" title="Points lost" />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {data.sources.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <LegendItem color={SOURCE_COLORS[s.key]} label={s.name} value={s.pointsGained.toFixed(1)} />
              <span className="w-[70px] shrink-0 text-right font-mono text-[11px] text-foreground-faint">−{s.pointsLost.toFixed(1)} lost</span>
            </div>
          ))}
        </div>
      </Card>

      {insights.length > 0 && (
        <Card className="mt-3.5 flex gap-2.5 border-violet/20 bg-violet-tint px-4 py-3.5">
          <Sparkles className="mt-0.5 size-[17px] shrink-0 text-violet-deep" aria-hidden />
          <div>
            <div className="text-label mb-1">Insight · computed from the data in view</div>
            <p className="text-[12.8px] text-foreground-muted">{insights.join(" ")}</p>
          </div>
        </Card>
      )}

      <SectionTitle
        icon={Gauge}
        hint="portfolio average, select one to see its sub-measures"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={scoreHref(params, { source: showAll ? null : "all" })} scroll={false}>
              {showAll ? "Show one source" : "Show all sub-measures"}
            </Link>
          </Button>
        }
      >
        Data source sub-scores
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7">
        {data.sources.map((s) => {
          const v = Math.round(s.now);
          const band = getHealthBand(v);
          const active = !showAll && s.key === focusKey;
          return (
            <Link
              key={s.key}
              href={scoreHref(params, { source: s.key })}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn("rounded-lg border bg-surface px-3 py-2.5 transition-colors hover:border-violet", active ? "border-violet ring-2 ring-violet-tint" : "border-border")}
            >
              <div className="flex justify-between gap-1 text-[11.5px]">
                <span className="truncate font-semibold">{s.shortName}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-foreground-faint">{s.below40} &lt;40</span>
              </div>
              <div className="my-1 flex items-baseline gap-2">
                <span className={cn("font-mono text-2xl font-bold", BAND_STYLES[band].text)}>{v}</span>
                <TrendIndicator delta={threeMonthDelta(s.history)} />
              </div>
              <Sparkline values={s.history} width={140} height={28} color={BAND_STYLES[band].color} className="w-full" />
            </Link>
          );
        })}
      </div>

      {panels.map((s) => {
        const metrics = data.metrics[s.key as HealthSourceKey] ?? [];
        const band = getHealthBand(Math.round(s.now));
        return (
          <Card key={s.key} className="mt-3.5 px-5 py-[18px]">
            <div className="mb-3.5 flex flex-wrap justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">{s.name}</h3>
                <p className="mt-0.5 text-[12.5px] text-foreground-faint">
                  {s.description} · averaged across {n} account{n === 1 ? "" : "s"}
                </p>
              </div>
              <dl className="flex flex-wrap gap-5">
                {[
                  ["Avg sub-score", <span key="v" className={BAND_STYLES[band].text}>{Math.round(s.now)}</span>],
                  ["Points lost", s.pointsLost.toFixed(1)],
                  ["Below 40", s.below40],
                  ["Weakest source for", s.weakestFor],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-[11px] text-foreground-faint">{label}</dt>
                    <dd className="font-mono text-[19px] font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <HealthTrendChart title={`${s.name}: average sub-score, last 12 months`} subtitle="shaded = middle 50% of accounts" labels={data.months} values={s.history} p25={s.p25} p75={s.p75} color={BAND_STYLES[band].color} height={150} valueLabel={`${s.shortName} sub-score`} />
            {metrics.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map((m) => (
                  <MetricCard
                    key={m.key}
                    name={m.name}
                    hint={m.hint}
                    format={m}
                    higherIsBetter={m.higherIsBetter}
                    months={data.months}
                    raw={m.raw}
                    p25={m.p25}
                    p75={m.p75}
                    score={m.score}
                    valueSuffix="avg · vs. 3 months ago"
                    footer={
                      <>
                        <span className={m.below40 ? "text-critical" : undefined}>{m.below40} below 40</span>
                        <span className={m.declining ? "text-at-risk" : undefined}>{m.declining} declining</span>
                      </>
                    }
                    weakest={m.weakest.map((w) => ({ href: scoreHref(params, { account: w.accountId, source: s.key }), name: w.name, raw: w.raw, score: w.score }))}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[12.5px] text-foreground-faint">No sub-measure history recorded for these accounts yet.</p>
            )}
          </Card>
        );
      })}

      <SectionTitle icon={Filter} hint="average sub-scores per group — click a row to filter to it">
        Compare by
      </SectionTitle>
      <div className="mb-2 inline-flex overflow-hidden rounded-[7px] border border-border" role="group" aria-label="Group accounts by">
        {GROUPS.map(([k, l]) => (
          <Link
            key={k}
            href={scoreHref(params, { group: k === "lifecycle" ? null : k })}
            scroll={false}
            aria-pressed={group === k}
            className={cn("border-r border-border px-3 py-1.5 text-xs font-medium last:border-r-0", group === k ? "bg-primary text-white" : "bg-surface text-foreground-muted hover:bg-surface-muted")}
          >
            {l}
          </Link>
        ))}
      </div>
      <Card className="overflow-x-auto px-2.5 py-1">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Average sub-scores by {GROUPS.find((g) => g[0] === group)?.[1]}</caption>
          <thead>
            <tr>
              <th scope="col" className="text-label px-2 py-2.5 text-left">{GROUPS.find((g) => g[0] === group)?.[1]}</th>
              <th scope="col" className="text-label px-2 py-2.5 text-left">Accounts</th>
              <th scope="col" className="text-label px-2 py-2.5 text-left">ARR</th>
              <th scope="col" className="text-label px-2 py-2.5 text-center">Health</th>
              {HEALTH_SOURCES.map((s) => (
                <th key={s.key} scope="col" title={s.name} className="text-label px-1 py-2.5 text-center">{s.shortName}</th>
              ))}
              <th scope="col" className="text-label px-2 py-2.5 text-left">At risk</th>
            </tr>
          </thead>
          <tbody>
            {groupRows.map((g) => {
              const risk = g.items.filter((i) => i.band === "atRisk" || i.band === "critical").length;
              const href = scoreHref(params, groupFilter(g.key));
              return (
                <tr key={g.key} tabIndex={0} onClick={() => router.push(href, { scroll: false })} onKeyDown={(e) => e.key === "Enter" && router.push(href, { scroll: false })} className="cursor-pointer border-t border-border hover:bg-surface-muted focus-visible:bg-violet-tint/40 focus-visible:outline-none">
                  <td className="px-2 py-2 font-semibold whitespace-nowrap">{g.key}</td>
                  <td className="px-2 py-2 font-mono">{g.items.length}</td>
                  <td className="px-2 py-2 font-mono whitespace-nowrap">{formatCurrency(g.items.reduce((s, i) => s + i.arr, 0))}</td>
                  <td className="px-1 py-2 text-center"><HeatCell value={avg(g.items.map((i) => i.score))} /></td>
                  {HEALTH_SOURCES.map((s) => (
                    <td key={s.key} className="px-1 py-2 text-center"><HeatCell value={avg(g.items.map((i) => i.sources[s.key] ?? 0))} /></td>
                  ))}
                  <td className={cn("px-2 py-2 font-mono", risk ? "text-at-risk" : "text-foreground-faint")}>{risk}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <SectionTitle icon={Building2} hint="click a row to open its deep-dive, or a column header to sort">
        Accounts
      </SectionTitle>
      <Card className="overflow-x-auto px-2.5 py-1">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Accounts with health sub-scores</caption>
          <thead>
            <tr>
              {[
                ["name", "Account"],
                [null, "CSM"],
                ["renewal", "Renewal"],
                ["score", "Health"],
              ].map(([key, label]) => (
                <th key={label} scope="col" aria-sort={key && sort === key ? "ascending" : undefined} className="text-label px-2 py-2.5 text-left whitespace-nowrap">
                  {key ? (
                    <Link href={scoreHref(params, { sort: key === "score" ? null : key })} scroll={false} className={cn("hover:text-foreground", sort === key && "text-primary")}>
                      {label}
                      {sort === key ? " ↑" : ""}
                    </Link>
                  ) : (
                    label
                  )}
                </th>
              ))}
              {HEALTH_SOURCES.map((s) => (
                <th key={s.key} scope="col" title={s.name} aria-sort={sort === s.key ? "ascending" : undefined} className="text-label px-1 py-2.5 text-center">
                  <Link href={scoreHref(params, { sort: s.key })} scroll={false} className={cn("hover:text-foreground", sort === s.key && "text-primary")}>
                    {s.shortName}
                    {sort === s.key ? " ↑" : ""}
                  </Link>
                </th>
              ))}
              <th scope="col" className="text-label px-2 py-2.5 text-left">12-mo trend</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => {
              const href = scoreHref(params, { account: i.id, source: null });
              return (
                <tr key={i.id} tabIndex={0} onClick={() => router.push(href)} onKeyDown={(e) => e.key === "Enter" && router.push(href)} className="cursor-pointer border-t border-border hover:bg-surface-muted focus-visible:bg-violet-tint/40 focus-visible:outline-none">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2.5">
                      <AccountAvatar name={i.name} />
                      <div className="min-w-0">
                        <div className="font-semibold whitespace-nowrap">{i.name}</div>
                        <div className="text-[11.5px] whitespace-nowrap text-foreground-faint">
                          {i.lifecycle} · {i.segment} · {formatCurrency(i.arr)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{i.ownerName ?? "—"}</td>
                  <td className="px-2 py-2 font-mono whitespace-nowrap">{i.renewalInDays === null ? "—" : `${i.renewalInDays}d`}</td>
                  <td className="px-2 py-2"><ScoreBadge score={i.score} band={i.band} /></td>
                  {HEALTH_SOURCES.map((s) => (
                    <td key={s.key} className="px-1 py-2 text-center"><HeatCell value={i.sources[s.key] ?? 0} /></td>
                  ))}
                  <td className="px-2 py-2"><Sparkline values={i.history} width={90} height={26} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
