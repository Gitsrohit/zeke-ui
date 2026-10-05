import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { SourceWeights } from "@/config/health";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { Card } from "@/components/shared/card";
import { HealthBadge, ScoreBadge } from "@/components/shared/health-badge";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Pill } from "@/components/shared/pill";
import { AccountActions } from "@/features/accounts/components/account-actions";
import { ActivityPanel, ContactsPanel, HealthPanel, OpportunitiesPanel, OverviewPanel, TasksPanel, TimelinePanel } from "@/features/accounts/components/account-panels";
import { NotesPanel } from "@/features/accounts/components/notes-panel";
import { getAccountDetail, getAccountFilterOptions } from "@/features/accounts/services/account.service";
import { getAgentLibrary } from "@/features/agents/services/agent.service";
import { getAIProvider } from "@/features/ai";
import { generateRootCause } from "@/features/outcomes/domain/risk";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { can } from "@/lib/server/context";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "health", label: "Health" },
  { key: "activity", label: "Activity" },
  { key: "contacts", label: "Contacts" },
  { key: "opportunities", label: "Opportunities" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes" },
  { key: "timeline", label: "Timeline" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const load = cache(async (accountId: string) => {
  const ctx = await getServiceContext();
  try {
    return { ctx, detail: await getAccountDetail(ctx, accountId) };
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) return { ctx, detail: null };
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<"/accounts/[accountId]">): Promise<Metadata> {
  const { accountId } = await params;
  const { detail } = await load(accountId);
  return { title: detail?.account.name ?? "Account" };
}

export default async function AccountPage({ params, searchParams }: PageProps<"/accounts/[accountId]">) {
  const [{ accountId }, sp] = await Promise.all([params, searchParams]);
  const { ctx, detail } = await load(accountId);
  if (!detail) return <PermissionDenied permission="accounts.read" />;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "overview";
  const { account } = detail;

  const canLaunch = can(ctx, "agents.launch");
  const canWrite = can(ctx, "accounts.write");
  const [library, options, summary] = await Promise.all([
    canLaunch ? getAgentLibrary(ctx) : Promise.resolve([]),
    canWrite ? getAccountFilterOptions(ctx) : Promise.resolve({ lifecycles: [], segments: [], owners: [] }),
    tab === "overview"
      ? getAIProvider().summarizeAccount({
          facts: detail.facts,
          contributions: detail.contributions,
          activeAgentNames: detail.runs.filter((r) => r.status === "active").map((r) => r.agentName),
          openWorkItems: detail.openWork.length,
          recentNotes: detail.notes.slice(0, 3).map((n) => n.body),
        })
      : Promise.resolve(""),
  ]);
  const agents = library.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name, category: a.category, key: a.key }));
  const weights = detail.scorecard.weights as SourceWeights | null;
  const rootCause = weights && Object.keys(detail.sources).length ? generateRootCause({ facts: detail.facts, sources: detail.sources, weights }) : null;
  const recommendedAgentId = agents.find((a) => a.key === rootCause?.recommendedAgentKey)?.id ?? null;

  return (
    <>
      <Card className="mb-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <AccountAvatar name={account.name} size="lg" />
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="mb-0.5 font-mono text-[11px] text-foreground-faint">
                <Link href="/accounts" className="hover:text-primary hover:underline">
                  Accounts
                </Link>{" "}
                / {account.name}
              </nav>
              <h1 className="truncate text-xl font-bold sm:text-[22px]">{account.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Pill tone="neutral">{account.lifecycle}</Pill>
                <Pill tone="neutral">{account.segment}</Pill>
                <HealthBadge band={account.band} />
                {detail.profile.status === "churned" && <Pill tone="critical">Churned</Pill>}
                <span className="font-mono text-[11.5px] text-foreground-faint">Owner: {account.ownerName ?? "Unassigned"}</span>
              </div>
            </div>
          </div>
          <AccountActions
            accountId={account.id}
            accountName={account.name}
            canWrite={canWrite}
            canWork={can(ctx, "work.manage")}
            canLaunch={canLaunch}
            agents={agents}
            recommendedAgentId={recommendedAgentId}
            options={options}
            formValues={{
              name: account.name,
              domain: account.domain ?? "",
              industry: detail.profile.industry ?? "",
              lifecycleStageId: detail.profile.lifecycleStageId,
              segmentId: detail.profile.segmentId,
              ownerId: account.ownerId ?? "",
              arr: account.arr,
              renewalDate: account.renewalDate ?? "",
              licensedSeats: detail.profile.licensedSeats === null ? "" : String(detail.profile.licensedSeats),
            }}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-[11.5px] text-foreground-faint">Health score</dt>
            <dd className="mt-0.5">
              <ScoreBadge score={account.score} band={account.band} />
            </dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-foreground-faint">ARR</dt>
            <dd className="font-mono text-[15px] font-bold">{formatCurrency(account.arr)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-foreground-faint">Predictive risk</dt>
            <dd className="font-mono text-[15px] font-bold">{account.predictiveRisk}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-foreground-faint">Renewal</dt>
            <dd className="font-mono text-[13px] font-semibold">{account.renewalDate ? `${formatDate(account.renewalDate)} · ${account.renewalInDays}d` : "—"}</dd>
          </div>
        </dl>
      </Card>

      <nav aria-label="Account sections" className="mb-5 flex gap-5 overflow-x-auto border-b border-border scrollbar-thin">
        {TABS.map((t) => {
          const count = t.key === "contacts" ? detail.contacts.length : t.key === "notes" ? detail.notes.length : t.key === "tasks" ? detail.openWork.length : t.key === "opportunities" ? detail.opportunities.length : null;
          return (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/accounts/${account.id}` : `/accounts/${account.id}?tab=${t.key}`}
              scroll={false}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn("-mb-px shrink-0 border-b-2 px-1 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors", tab === t.key ? "border-violet text-primary" : "border-transparent text-foreground-faint hover:text-foreground-muted")}
            >
              {t.label}
              {count !== null && count > 0 && <span className="ml-1 font-mono text-[11px] font-normal">({count})</span>}
            </Link>
          );
        })}
      </nav>

      {tab === "overview" && <OverviewPanel detail={detail} summary={summary} />}
      {tab === "health" && <HealthPanel detail={detail} />}
      {tab === "activity" && <ActivityPanel detail={detail} />}
      {tab === "contacts" && <ContactsPanel detail={detail} />}
      {tab === "opportunities" && <OpportunitiesPanel detail={detail} />}
      {tab === "tasks" && <TasksPanel detail={detail} />}
      {tab === "notes" && <NotesPanel accountId={account.id} notes={detail.notes} canWrite={canWrite} currentUserName={ctx.userName} />}
      {tab === "timeline" && <TimelinePanel detail={detail} />}
    </>
  );
}
