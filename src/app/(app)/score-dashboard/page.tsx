import { FileDown, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HEALTH_SOURCE_KEYS, type HealthSourceKey } from "@/config/health";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Button } from "@/components/ui/button";
import { getAccountFilterOptions } from "@/features/accounts/services/account.service";
import { AccountDeepDive } from "@/features/health/components/account-deep-dive";
import { PortfolioView, type GroupKey } from "@/features/health/components/portfolio-view";
import { ScoreFilterBar } from "@/features/health/components/score-filter-bar";
import { flatParams, scoreHref } from "@/features/health/components/score-helpers";
import { getScoreAccount, getScorePortfolio, parseScoreFilters, type ScoreFilters } from "@/features/health/services/score-dashboard.service";
import type { ServiceContext } from "@/lib/server/context";
import { API } from "@/lib/api/endpoints";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Advanced Score Dashboard" };

const GROUP_KEYS: GroupKey[] = ["lifecycle", "segment", "owner", "band"];
const FILTER_KEYS = ["q", "stage", "segment", "csm", "band", "trend", "arr", "renew", "weak", "subSrc", "subOp", "sort"];

export default async function ScoreDashboardPage({ searchParams }: PageProps<"/score-dashboard">) {
  const raw = await searchParams;
  const params = flatParams(raw);
  const filters = parseScoreFilters(raw);
  const ctx = await getServiceContext();
  const accountId = params.account;
  const source = params.source === "all" ? "all" : HEALTH_SOURCE_KEYS.includes(params.source as HealthSourceKey) ? (params.source as HealthSourceKey) : undefined;
  const group = GROUP_KEYS.includes(params.group as GroupKey) ? (params.group as GroupKey) : "lifecycle";
  const exportParams = new URLSearchParams(Object.entries(params).filter(([k]) => FILTER_KEYS.includes(k)));

  const loaded = await load(ctx, filters, params, source);
  if (loaded.kind === "forbidden") return <PermissionDenied permission="accounts.read" />;
  if (loaded.kind === "redirect") redirect(loaded.href);
  if (loaded.kind === "missing") {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title="Account not found"
          description="It may have been removed, or it's outside your access."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={scoreHref(params, { account: null, source: null })}>Back to portfolio</Link>
            </Button>
          }
        />
      </Card>
    );
  }
  const { options } = loaded;
  const counts = loaded.kind === "account" ? { matching: loaded.data.list.length, total: loaded.data.totalAccounts } : { matching: loaded.data.items.length, total: loaded.data.totalAccounts };

  const tab = (label: string, active: boolean, href: string) => (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn("-mb-px border-b-2 px-1 py-2 text-[13.5px] font-semibold whitespace-nowrap", active ? "border-violet text-primary" : "border-transparent text-foreground-faint hover:text-foreground-muted")}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Advanced Score Dashboard"
        description="Open up any health score, for one account or your whole book. See each data source's sub-score, the sub-measures behind it, and how every one has moved over the last 12 months."
        actions={
          <Button asChild variant="outline">
            <a href={API.scoreDashboardExport(exportParams)} download>
              <FileDown /> Export CSV
            </a>
          </Button>
        }
      />
      <nav aria-label="Dashboard mode" className="mb-3.5 flex gap-5 border-b border-border">
        {tab("Portfolio overview", !accountId, scoreHref(params, { account: null, source: null }))}
        {tab("Account deep-dive", Boolean(accountId), accountId ? scoreHref(params) : scoreHref(params, { account: "first" }))}
      </nav>
      <ScoreFilterBar owners={options.owners} matching={counts.matching} total={counts.total} />
      {loaded.kind === "account" ? <AccountDeepDive data={loaded.data} params={params} /> : <PortfolioView data={loaded.data} params={params} group={group} owners={options.owners} />}
    </>
  );
}

type Loaded =
  | { kind: "forbidden" }
  | { kind: "redirect"; href: string }
  | { kind: "missing" }
  | { kind: "account"; options: FilterOptions; data: NonNullable<Awaited<ReturnType<typeof getScoreAccount>>> }
  | { kind: "portfolio"; options: FilterOptions; data: Awaited<ReturnType<typeof getScorePortfolio>> };
type FilterOptions = Awaited<ReturnType<typeof getAccountFilterOptions>>;

async function load(ctx: ServiceContext, filters: ScoreFilters, params: Record<string, string>, source: HealthSourceKey | "all" | undefined): Promise<Loaded> {
  try {
    const options = await getAccountFilterOptions(ctx);
    const accountId = params.account;
    if (accountId === "first") {
      // "Account deep-dive" tab without a selection: open the first account matching the filters.
      const portfolio = await getScorePortfolio(ctx, filters);
      const first = portfolio.items[0]?.id;
      return { kind: "redirect", href: first ? scoreHref(params, { account: first }) : scoreHref(params, { account: null }) };
    }
    if (accountId) {
      const data = await getScoreAccount(ctx, filters, accountId);
      return data ? { kind: "account", options, data } : { kind: "missing" };
    }
    return { kind: "portfolio", options, data: await getScorePortfolio(ctx, filters, source) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { kind: "forbidden" };
    throw error;
  }
}
