"use client";

import { ArrowLeft, ArrowRight, ChevronRight, Eye, Gauge, GitMerge, Sparkles } from "lucide-react";
import Link from "next/link";
import type { HealthSourceKey } from "@/config/health";
import { ContributionStack } from "@/components/charts/contribution-stack";
import { HealthTrendChart } from "@/components/charts/health-trend-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { Card } from "@/components/shared/card";
import { HealthBadge, ScoreBadge } from "@/components/shared/health-badge";
import { Pill } from "@/components/shared/pill";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { SectionTitle } from "@/components/shared/section-title";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { Button } from "@/components/ui/button";
import { getHealthBand, getPredictiveRiskLevel } from "@/features/health/domain/score";
import type { ScoreAccount } from "@/features/health/services/score-dashboard.service";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { MetricCard } from "./metric-card";
import { accountInsights, impactLabel, scoreHref, threeMonthDelta } from "./score-helpers";

const RISK_TEXT = { high: "text-critical", elevated: "text-at-risk", low: "text-thriving" } as const;
const CHAIN = ["Overall score", "Health scorecard", "Data sources", "Sub-metrics", "Historical trend"];

export function AccountDeepDive({ data, params }: { data: ScoreAccount; params: Record<string, string> }) {
  const { account, sources } = data;
  const byLost = [...sources].sort((a, b) => b.pointsLost - a.pointsLost);
  const showAll = params.source === "all";
  const selected = (sources.find((s) => s.key === params.source)?.key ?? byLost[0].key) as HealthSourceKey;
  const panels = showAll ? sources : sources.filter((s) => s.key === selected);
  const insight = accountInsights(data);
  const riskLevel = getPredictiveRiskLevel(account.predictiveRisk);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
      <Card className="flex max-h-[240px] flex-col overflow-hidden xl:sticky xl:top-0 xl:max-h-[calc(100dvh-180px)]">
        <div className="text-label border-b border-border px-3.5 py-2.5">{data.list.length} matching</div>
        <nav aria-label="Matching accounts" className="overflow-y-auto p-1.5">
          {data.list.length === 0 && <p className="p-3 text-xs text-foreground-faint">No accounts match these filters.</p>}
          {data.list.map((a) => (
            <Link
              key={a.id}
              href={scoreHref(params, { account: a.id, source: null })}
              scroll={false}
              aria-current={a.id === account.id ? "page" : undefined}
              className={cn("flex items-center justify-between gap-2 rounded-[7px] px-2.5 py-2 hover:bg-surface-muted", a.id === account.id && "bg-violet-tint shadow-[inset_3px_0_0_var(--violet)]")}
            >
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold">{a.name}</span>
                <span className="block truncate text-[10.5px] text-foreground-faint">
                  {a.lifecycle} · {a.segment} · {a.ownerName ?? "Unassigned"}
                </span>
              </span>
              <ScoreBadge score={a.score} band={a.band} size="sm" />
            </Link>
          ))}
        </nav>
      </Card>

      <div className="min-w-0">
        <Card className="grid items-center gap-5 px-5 py-[18px] lg:grid-cols-[minmax(240px,1fr)_auto_minmax(260px,1.3fr)]">
          <div>
            <div className="flex items-center gap-3">
              <AccountAvatar name={account.name} size="lg" />
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{account.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Pill>{account.lifecycle}</Pill>
                  <Pill>{account.segment}</Pill>
                  <HealthBadge band={account.band} />
                </div>
              </div>
            </div>
            <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
              <div>
                <dt className="text-[11px] text-foreground-faint">CSM</dt>
                <dd className="font-semibold">{account.ownerName ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-foreground-faint">ARR</dt>
                <dd className="font-mono font-semibold">{formatCurrency(account.arr)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-foreground-faint">Renewal in</dt>
                <dd className="font-mono font-semibold">{account.renewalInDays === null ? "—" : `${account.renewalInDays}d`}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-foreground-faint">Predictive risk</dt>
                <dd className={cn("font-mono font-semibold", RISK_TEXT[riskLevel])}>
                  {account.predictiveRisk} <span className="font-sans text-[11px] font-normal">({riskLevel})</span>
                </dd>
              </div>
            </dl>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {data.neighbours.previous ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={scoreHref(params, { account: data.neighbours.previous, source: null })} scroll={false}>
                    <ArrowLeft /> Prev
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ArrowLeft /> Prev
                </Button>
              )}
              {data.neighbours.next ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={scoreHref(params, { account: data.neighbours.next, source: null })} scroll={false}>
                    Next <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next <ArrowRight />
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href={`/accounts/${account.id}`}>
                  <Eye /> Account details
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <ScoreGauge score={account.score} band={account.band} />
            <div className="mt-1 font-mono text-[11px] text-foreground-faint">
              {account.lifecycle} · {account.segment} scorecard
            </div>
          </div>
          <HealthTrendChart
            title="Overall health — last 12 months"
            subtitle={`${threeMonthDelta(account.history) >= 0 ? "+" : ""}${threeMonthDelta(account.history)} in 3 months`}
            labels={data.months}
            values={account.history}
            thresholds={account.thresholds}
            domain={[0, 100]}
            color={BAND_STYLES[account.band].color}
            height={160}
            valueLabel="Health score"
          />
        </Card>

        <ol aria-label="How this score is explained" className="mt-3.5 flex flex-wrap items-center gap-1 text-[11.5px] text-foreground-muted">
          {CHAIN.map((step, i) => (
            <li key={step} className="flex items-center gap-1">
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium">{step}</span>
              {i < CHAIN.length - 1 && <ChevronRight className="size-3.5 text-foreground-faint" aria-hidden />}
            </li>
          ))}
        </ol>

        <SectionTitle icon={GitMerge} hint="sub-score × scorecard weight = points contributed">
          How the {account.score} is built
        </SectionTitle>
        <Card className="px-[18px] py-4">
          <ContributionStack contributions={sources.map((s) => ({ source: s.key, points: s.points, pointsLost: s.pointsLost, normalizedWeight: s.normalizedWeight }))} />
        </Card>

        <Card className="mt-3.5 flex gap-2.5 border-violet/20 bg-violet-tint px-4 py-3.5">
          <Sparkles className="mt-0.5 size-[17px] shrink-0 text-violet-deep" aria-hidden />
          <div>
            <div className="text-label mb-1">Insight · computed from this account&apos;s data</div>
            <p className="text-[12.8px] text-foreground-muted">
              <b className="text-foreground">{insight.headline}</b> {insight.sentences.join(" ")}
            </p>
          </div>
        </Card>

        <SectionTitle
          icon={Gauge}
          hint="select one to see its sub-measures"
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-4">
          {sources.map((s) => {
            const band = getHealthBand(s.score);
            const active = !showAll && s.key === selected;
            return (
              <Link
                key={s.key}
                href={scoreHref(params, { source: s.key })}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn("rounded-lg border bg-surface px-3 py-2.5 transition-colors hover:border-violet", active ? "border-violet ring-2 ring-violet-tint" : "border-border")}
              >
                <div className="flex justify-between gap-1 text-[11.5px]">
                  <span className="truncate font-semibold">{s.name}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-foreground-faint">wt {s.weight}%</span>
                </div>
                <div className="my-1 flex flex-wrap items-baseline gap-2">
                  <span className={cn("font-mono text-2xl font-bold", BAND_STYLES[band].text)}>{s.score}</span>
                  <TrendIndicator delta={s.change3m} />
                </div>
                <Sparkline values={s.history} width={150} height={28} color={BAND_STYLES[band].color} className="w-full" />
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <HealthBadge band={band} />
                  <span className="font-mono text-[10.5px] text-foreground-faint">{impactLabel(s.pointsLost)} impact</span>
                </div>
              </Link>
            );
          })}
        </div>

        {panels.map((s) => {
          const band = getHealthBand(s.score);
          return (
            <Card key={s.key} className="mt-3.5 px-5 py-[18px]">
              <div className="mb-3.5 flex flex-wrap justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">{s.name}</h3>
                  <p className="mt-0.5 text-[12.5px] text-foreground-faint">{s.description}</p>
                </div>
                <dl className="flex flex-wrap gap-5">
                  {[
                    ["Sub-score", <span key="v" className={BAND_STYLES[band].text}>{s.score}</span>],
                    ["Weight", `${s.weight}%`],
                    ["Contribution", `${s.points.toFixed(1)} pts`],
                    ["Peer avg", Math.round(s.peerAverage)],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-[11px] text-foreground-faint">{label}</dt>
                      <dd className="font-mono text-[19px] font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <HealthTrendChart title={`${s.name} sub-score — last 12 months`} labels={data.months} values={s.history} domain={[0, 100]} color={BAND_STYLES[band].color} height={150} valueLabel="Sub-score" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {s.metrics.map((m) => (
                  <MetricCard
                    key={m.key}
                    name={m.name}
                    hint={m.hint}
                    format={m}
                    higherIsBetter={m.higherIsBetter}
                    months={data.months}
                    raw={m.raw}
                    score={m.scores[m.scores.length - 1] ?? 0}
                    footer={
                      <>
                        <span>{m.higherIsBetter ? "Higher" : "Lower"} is better</span>
                        <span>{m.weight}% of source</span>
                      </>
                    }
                  />
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
