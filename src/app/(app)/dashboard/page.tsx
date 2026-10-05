import { Building2, CalendarClock, Gauge, Target, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HealthDistributionChart } from "@/components/charts/health-distribution-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreBadge } from "@/components/shared/health-badge";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Pill } from "@/components/shared/pill";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import { AccountsTable } from "@/features/accounts/components/accounts-table";
import { loadLaunchableAgents } from "@/features/accounts/components/load-launchable-agents";
import { getAccountFilterOptions } from "@/features/accounts/services/account.service";
import { LifecycleCards } from "@/features/dashboard/components/lifecycle-cards";
import { RecalculateButton } from "@/features/dashboard/components/recalculate-button";
import { getDashboardOverview, getRenewalForecast } from "@/features/dashboard/services/dashboard.service";
import { getServiceContext } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { can, type ServiceContext } from "@/lib/server/context";
import { formatCurrency, pluralize } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

const TABS = [
  { key: "accounts", label: "Accounts" },
  { key: "forecast", label: "Renewal Forecast" },
] as const;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const ctx = await getServiceContext();
  if (!can(ctx, "accounts.read")) return <PermissionDenied permission="accounts.read" />;
  const params = await searchParams;
  const tab = params.tab === "forecast" ? "forecast" : "accounts";

  return (
    <>
      <PageHeader
        title="Every account, one health signal"
        description="Live scores computed from telemetry, survey, meeting, ticket, renewal, CRM and contact-hygiene data across your book of business."
        actions={
          <>
            {can(ctx, "scorecards.manage") && <RecalculateButton />}
            <Button asChild>
              <Link href="/audiences/new">
                <Target /> Build an audience
              </Link>
            </Button>
          </>
        }
      />
      <nav aria-label="Dashboard views" className="mb-5 flex gap-5 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "accounts" ? "/dashboard" : `/dashboard?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-1 py-2 text-[13.5px] font-semibold transition-colors", tab === t.key ? "border-violet text-primary" : "border-transparent text-foreground-faint hover:text-foreground-muted")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "forecast" ? <ForecastTab ctx={ctx} /> : <AccountsTab ctx={ctx} />}
    </>
  );
}

async function AccountsTab({ ctx }: { ctx: ServiceContext }) {
  const [overview, options, agents] = await Promise.all([getDashboardOverview(ctx), getAccountFilterOptions(ctx), loadLaunchableAgents(ctx)]);
  const k = overview.kpis;
  const riskCount = k.atRisk + k.critical;
  return (
    <>
      <KpiGrid className="lg:grid-cols-5">
        <KpiCard label="Tracked accounts" value={k.totalAccounts} detail={`${formatCurrency(k.totalArr)} ARR`} />
        <KpiCard
          label="Average health"
          value={k.averageScore}
          trend={k.averageScoreDelta > 0 ? "up" : k.averageScoreDelta < 0 ? "down" : null}
          detail={`${Math.abs(k.averageScoreDelta)} pts vs. 90 days ago`}
        />
        <KpiCard label="At risk / critical" value={riskCount} valueClassName={riskCount ? "text-at-risk" : undefined} detail={`${formatCurrency(k.atRiskArr)} ARR exposed`} />
        <KpiCard label="Renewals · 90 days" value={k.renewals90} detail={`${formatCurrency(k.renewals90Arr)} ARR`} />
        <KpiCard label="Expansion potential" value={formatCurrency(k.expansionPotential)} valueClassName="text-thriving" detail={`${pluralize(k.expansionAccounts, "account")} · illustrative`} className="col-span-2 lg:col-span-1" />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="p-4 sm:p-5">
          <SectionTitle icon={Gauge} className="mt-0" as="h2">
            Health distribution
          </SectionTitle>
          {k.totalAccounts ? <HealthDistributionChart data={overview.distribution} /> : <EmptyState compact title="No accounts yet" description="Health appears here once accounts are scored." />}
        </Card>
        <div>
          <SectionTitle icon={Gauge} className="mt-0" hint="average score and band mix per lifecycle stage">
            By lifecycle
          </SectionTitle>
          <LifecycleCards items={overview.byLifecycle} />
          <p className="mt-3 text-[11.5px] text-foreground-faint">
            Each stage is scored with its own weighting model.{" "}
            <Link href="/scorecards" className="font-semibold text-primary hover:underline">
              Review scorecards
            </Link>
          </p>
        </div>
      </div>

      <SectionTitle icon={Building2}>All accounts</SectionTitle>
      <AccountsTable options={options} agents={agents} canLaunch={can(ctx, "agents.launch")} caption="All accounts, sorted by health" />
    </>
  );
}

const FORECAST_TONE = { Committed: "thriving", "At risk": "atRisk", "Likely churn": "critical" } as const;

async function ForecastTab({ ctx }: { ctx: ServiceContext }) {
  const f = await getRenewalForecast(ctx);
  return (
    <>
      <KpiGrid>
        <KpiCard label="ARR renewing · 90 days" value={formatCurrency(f.arr90)} detail={`${formatCurrency(f.arr180)} within 180 days`} />
        <KpiCard label="Weighted forecast (180d)" value={formatCurrency(f.weighted180)} valueClassName="text-violet-deep" detail="ARR × win probability by band" />
        <KpiCard label="ARR at risk (180d)" value={formatCurrency(f.atRisk180)} valueClassName={f.atRisk180 ? "text-critical" : undefined} detail="at-risk / critical renewing soon" />
        <KpiCard label="Expansion pipeline" value={formatCurrency(f.expansionPipeline)} valueClassName="text-thriving" detail={`${pluralize(f.expansionCount, "thriving Growth account")}`} />
      </KpiGrid>

      <Card className="p-4 sm:p-5">
        <StackedBarChart
          title="Renewing ARR by month"
          subtitle="next 6 months, split by health"
          label={`Renewing ARR by month for the next 6 months, committed versus at risk`}
          data={f.monthly}
          categoryKey="month"
          series={[
            { key: "committed", label: "Committed (thriving / stable)", color: "var(--thriving)" },
            { key: "atRisk", label: "At risk (at risk / critical)", color: "var(--critical)" },
          ]}
          format="currency"
          height={200}
        />
      </Card>

      <SectionTitle icon={CalendarClock}>Renewal pipeline — next 180 days</SectionTitle>
      <Card className="overflow-x-auto">
        {f.pipeline.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing renewing in the next 180 days" description="The pipeline is clear for now." />
        ) : (
          <table className="w-full text-[13px]">
            <caption className="sr-only">Renewal pipeline for the next 180 days</caption>
            <thead>
              <tr>
                {["Account", "ARR", "Renews in", "Health", "Forecast", "Win prob.", "Owner"].map((h) => (
                  <th key={h} scope="col" className="text-label border-b border-border px-3 pt-3 pb-2.5 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.pipeline.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-3 py-2.5">
                    <Link href={`/accounts/${a.id}`} className="flex items-center gap-2.5 font-semibold hover:text-primary">
                      <AccountAvatar name={a.name} size="sm" /> {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{formatCurrency(a.arr)}</td>
                  <td className="px-3 py-2.5 font-mono">{a.renewalInDays}d</td>
                  <td className="px-3 py-2.5">
                    <ScoreBadge score={a.score} band={a.band} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={FORECAST_TONE[a.forecast]} dot>
                      {a.forecast}
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{Math.round(a.winProbability * 100)}%</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{a.ownerName ?? "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SectionTitle icon={TrendingUp}>Expansion-ready accounts</SectionTitle>
      <Card className="overflow-x-auto">
        {f.expansionReady.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No thriving Growth-stage accounts right now" description="Accounts appear here once they reach Thriving in the Growth stage." />
        ) : (
          <table className="w-full text-[13px]">
            <caption className="sr-only">Expansion-ready accounts</caption>
            <thead>
              <tr>
                {["Account", "ARR", "Health", "Est. expansion", "Owner"].map((h) => (
                  <th key={h} scope="col" className="text-label border-b border-border px-3 pt-3 pb-2.5 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.expansionReady.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                  <td className="px-3 py-2.5">
                    <Link href={`/accounts/${a.id}`} className="flex items-center gap-2.5 font-semibold hover:text-primary">
                      <AccountAvatar name={a.name} size="sm" /> {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{formatCurrency(a.arr)}</td>
                  <td className="px-3 py-2.5">
                    <ScoreBadge score={a.score} band={a.band} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-thriving">+{formatCurrency(a.estimate)}</td>
                  <td className="px-3 py-2.5">{a.ownerName ?? "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-[11.5px] text-foreground-faint">
        Win probabilities and expansion estimates are illustrative defaults by health band — connect Chargebee or CRM deal data in{" "}
        <Link href="/admin/integrations" className="font-semibold text-primary hover:underline">
          Admin
        </Link>{" "}
        to replace them with real figures.
      </p>
    </>
  );
}
