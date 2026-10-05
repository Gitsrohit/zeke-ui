import {
  Activity,
  BadgeCheck,
  Bot,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Gauge,
  Layers,
  ListChecks,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Star,
  Ticket,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { getHealthSource, type SourceWeights } from "@/config/health";
import { ContributionStack } from "@/components/charts/contribution-stack";
import { HealthTrendChart } from "@/components/charts/health-trend-chart";
import { SOURCE_COLORS } from "@/components/charts/palette";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Pill } from "@/components/shared/pill";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import type { AccountDetail } from "@/features/accounts/services/account.service";
import { getPredictiveRiskLevel } from "@/features/health/domain/score";
import { generateRootCause } from "@/features/outcomes/domain/risk";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatRelativeDays, formatRelativeTime, formatSigned } from "@/lib/utils/format";
import { daysSince } from "@/lib/utils/dates";
import { buildTimeline } from "./timeline";

const RISK_TEXT = { high: "text-critical", elevated: "text-at-risk", low: "text-thriving" } as const;
const RISK_LABEL = { high: "High risk", elevated: "Elevated", low: "Low risk" } as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11.5px] text-foreground-faint">{label}</dt>
      <dd className="font-mono text-[13px] font-semibold tabular">{children}</dd>
    </div>
  );
}

const WORK_ICONS: Record<string, LucideIcon> = { task: ClipboardList, call: Phone, email: Mail, follow_up: ListChecks, review: Layers, approval: BadgeCheck, decision: Sparkles };
const ACTIVITY_ICONS: Record<string, LucideIcon> = { meeting: CalendarDays, email: Mail, call: Phone, ticket: Ticket, login: Activity, survey: Star };
const TIMELINE_ICONS: Record<string, LucideIcon> = {
  ...ACTIVITY_ICONS,
  note: MessageSquare,
  work: ListChecks,
  agent_launched: Bot,
  agent_completed: Bot,
  band_changed: Gauge,
  account_created: Briefcase,
};

type WorkView = AccountDetail["openWork"][number];

function isOverdue(item: WorkView, now: Date = new Date()): boolean {
  return item.status !== "completed" && item.dueAt !== null && new Date(item.dueAt).getTime() < now.getTime();
}

function WorkRow({ item }: { item: WorkView }) {
  const Icon = WORK_ICONS[item.type] ?? ClipboardList;
  const overdue = isOverdue(item);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{item.title}</div>
        <div className="truncate font-mono text-[11px] text-foreground-faint">
          {item.agentName ? `${item.agentName} · ` : ""}
          {item.ownerName ?? "Unassigned"}
          {item.status === "completed" ? ` · done ${item.completedAt ? formatRelativeTime(item.completedAt) : ""}` : item.dueAt ? ` · due ${formatDate(item.dueAt)}` : ""}
        </div>
      </div>
      {overdue && <Pill tone="critical">Overdue</Pill>}
      {item.priority === "high" && item.status !== "completed" && <Pill tone="atRisk">High</Pill>}
    </li>
  );
}

export function OverviewPanel({ detail, summary }: { detail: AccountDetail; summary: string }) {
  const { account, facts, profile } = detail;
  const level = getPredictiveRiskLevel(account.predictiveRisk);
  const peerDiff = detail.peerAverage === null ? null : account.score - detail.peerAverage;
  const activeRuns = detail.runs.filter((r) => r.status === "active");
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="space-y-4">
        <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <Link href={`/score-dashboard?account=${account.id}`} className="self-center rounded-xl p-1 transition-colors hover:bg-violet-tint" aria-label="Open the full score breakdown">
            <ScoreGauge score={account.score} band={account.band} />
          </Link>
          <dl className="grid flex-1 grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
            <Fact label="ARR">{formatCurrency(account.arr)}</Fact>
            <Fact label="NPS">{profile.nps ?? "—"}</Fact>
            <Fact label="Renewal in">{account.renewalInDays === null ? "—" : `${account.renewalInDays}d`}</Fact>
            <Fact label="Last meeting">{formatRelativeDays(facts.lastMeetingDays)}</Fact>
            <Fact label="Last login">{formatRelativeDays(facts.lastLoginDays)}</Fact>
            <Fact label="Open tickets">{profile.openTickets}</Fact>
            <Fact label="Licensed seats">{profile.licensedSeats ?? "—"}</Fact>
            <Fact label="Key roles documented">
              {profile.keyRolesDocumented} / {profile.keyRolesTotal}
            </Fact>
            <Fact label="Industry">{profile.industry ?? "—"}</Fact>
          </dl>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Card className="px-4 py-3">
            <div className="text-[11.5px] text-foreground-faint">Predictive risk (30d projection)</div>
            <div className={cn("font-mono text-[17px] font-bold", RISK_TEXT[level])}>
              {account.predictiveRisk} <span className="text-xs font-semibold">· {RISK_LABEL[level]}</span>
            </div>
          </Card>
          <Card className="px-4 py-3">
            <div className="text-[11.5px] text-foreground-faint">vs. segment average {detail.peerAverage !== null && `(${detail.peerAverage})`}</div>
            <div className={cn("font-mono text-[17px] font-bold", peerDiff === null ? "text-foreground-faint" : peerDiff >= 0 ? "text-thriving" : "text-critical")}>{peerDiff === null ? "—" : `${formatSigned(peerDiff)} pts`}</div>
          </Card>
        </div>
        <Card className="border-violet/20 bg-violet-tint/50 p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-violet-deep">
            <Sparkles className="size-3.5" aria-hidden /> AI summary · generated from account data
          </div>
          <p className="text-[13px] text-foreground-muted">{summary}</p>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-4">
          <SectionTitle icon={Bot} className="mt-0" as="h3">
            Active agents
          </SectionTitle>
          {activeRuns.length === 0 ? (
            <p className="text-[12.5px] text-foreground-faint">No agents currently running on this account.</p>
          ) : (
            <ul className="space-y-2">
              {activeRuns.map((r) => (
                <li key={r.id}>
                  <Link href={`/agents/runs/${r.id}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 hover:border-violet">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{r.agentName}</span>
                      <span className="block truncate font-mono text-[11px] text-foreground-faint">
                        started {formatRelativeTime(r.startedAt)} · {r.sourceLabel}
                      </span>
                    </span>
                    <Pill tone="neutral">Running</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <SectionTitle icon={ListChecks} className="m-0" as="h3">
              Open tasks
            </SectionTitle>
            <Link href={`/accounts/${account.id}?tab=tasks`} className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {detail.openWork.length === 0 ? (
            <p className="px-4 pt-2 pb-4 text-[12.5px] text-foreground-faint">Nothing waiting on anyone for this account.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t border-border">
              {detail.openWork.slice(0, 4).map((w) => (
                <WorkRow key={w.id} item={w} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export function HealthPanel({ detail }: { detail: AccountDetail }) {
  const { account, facts } = detail;
  const weights = detail.scorecard.weights as SourceWeights | null;
  const rootCause = weights && Object.keys(detail.sources).length ? generateRootCause({ facts, sources: detail.sources, weights }) : null;
  const history = [...detail.history.map((h) => ({ label: formatDate(h.takenAt).replace(/, \d{4}$/, ""), score: h.score }))];
  if (!history.length || history[history.length - 1].score !== account.score) history.push({ label: "Now", score: account.score });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle
          icon={Gauge}
          className="mt-0"
          as="h3"
          hint={`${detail.scorecard.name} scorecard · sub-score × weight = points`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={`/score-dashboard?account=${account.id}`}>
                <Layers /> Full breakdown
              </Link>
            </Button>
          }
        >
          How the {account.score} is built
        </SectionTitle>
        <ContributionStack contributions={detail.contributions} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle className="mt-0" as="h3">
            Source sub-scores
          </SectionTitle>
          <ul className="space-y-3">
            {detail.contributions.map((c) => (
              <li key={c.source}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold">{getHealthSource(c.source).name}</span>
                  <span className="font-mono text-foreground-muted">
                    {c.score} <span className="text-foreground-faint">· wt {c.weight}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-border" role="img" aria-label={`${getHealthSource(c.source).name} ${c.score} of 100`}>
                  <div className="h-full rounded" style={{ width: `${c.score}%`, background: SOURCE_COLORS[c.source] }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={Sparkles} className="mt-0" as="h3">
            What&apos;s dragging the score
          </SectionTitle>
          {rootCause ? (
            <div className="space-y-3 text-[13px]">
              <div className="rounded-md border border-border p-3">
                <div className="text-label mb-1">Observed signal</div>
                <p className="text-foreground-muted">{rootCause.observedSignal}</p>
              </div>
              <div className="rounded-md border border-violet/20 bg-violet-tint/50 p-3">
                <div className="text-label mb-1 !text-violet-deep">AI inference · not a guaranteed fact</div>
                <p className="text-foreground-muted">{rootCause.inference}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-label mb-1">Recommended action</div>
                <p className="text-foreground-muted">{rootCause.recommendedAction}</p>
              </div>
            </div>
          ) : (
            <EmptyState compact title="Not enough data" description="Health sources haven't synced for this account yet." />
          )}
        </Card>
      </div>

      <Card className="p-5">
        {history.length > 1 ? (
          <HealthTrendChart title="Health score history" subtitle="snapshots, with band thresholds" labels={history.map((h) => h.label)} values={history.map((h) => h.score)} thresholds={detail.scorecard.thresholds} color={BAND_STYLES[account.band].color} domain={[0, 100]} height={200} />
        ) : (
          <EmptyState compact icon={TrendingUp} title="No history yet" description="Score history builds up as the account is recalculated." />
        )}
      </Card>
    </div>
  );
}

export function ActivityPanel({ detail }: { detail: AccountDetail }) {
  if (detail.activities.length === 0) return <EmptyState icon={Activity} title="No activity recorded" description="Meetings, emails, tickets and surveys from connected tools appear here." />;
  return (
    <Card className="max-w-3xl">
      <ul className="divide-y divide-border">
        {detail.activities.map((a) => {
          const Icon = ACTIVITY_ICONS[a.type] ?? Activity;
          return (
            <li key={a.id} className="flex gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{a.subject}</div>
                <div className="font-mono text-[11px] text-foreground-faint">
                  {a.type} · {formatRelativeTime(a.occurredAt)}
                  {a.userName ? ` · ${a.userName}` : ""}
                </div>
                {a.body && <p className="mt-1 text-[12.5px] text-foreground-muted">{a.body}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const CONTACT_TONE = { active: "thriving", new: "neutral", quiet: "atRisk" } as const;
const CONTACT_LABEL = { active: "Active", new: "New", quiet: "Went quiet" } as const;

export function ContactsPanel({ detail }: { detail: AccountDetail }) {
  if (detail.contacts.length === 0) return <EmptyState icon={UserRound} title="No contacts on file" description="Contact hygiene data hasn't synced for this account yet." />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {detail.contacts.map((c) => {
        const name = `${c.firstName} ${c.lastName}`;
        const days = daysSince(c.lastEngagedAt ? new Date(c.lastEngagedAt) : null);
        return (
          <Card key={c.id} className="flex items-start gap-3 p-4">
            <AccountAvatar name={name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-semibold">{name}</span>
                {c.isPrimary && <Pill tone="neutral">Primary</Pill>}
                {c.isChampion && (
                  <Pill tone="thriving" dot>
                    Champion
                  </Pill>
                )}
              </div>
              <div className="text-[12px] text-foreground-muted">{c.role ?? c.title ?? "Contact"}</div>
              <div className="mt-1 truncate font-mono text-[11px] text-foreground-faint">
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="hover:text-primary hover:underline">
                    {c.email}
                  </a>
                ) : (
                  "no email"
                )}
                {c.phone ? ` · ${c.phone}` : ""}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-foreground-faint">last engaged {formatRelativeDays(days)}</div>
            </div>
            <Pill tone={CONTACT_TONE[c.status]} dot>
              {CONTACT_LABEL[c.status]}
            </Pill>
          </Card>
        );
      })}
    </div>
  );
}

const STAGE_TONE: Record<string, "neutral" | "thriving" | "critical" | "violet" | "muted"> = { closed_won: "thriving", closed_lost: "critical", negotiation: "violet", proposal: "violet" };

export function OpportunitiesPanel({ detail }: { detail: AccountDetail }) {
  if (detail.opportunities.length === 0) return <EmptyState icon={Briefcase} title="No opportunities" description="Renewal and expansion opportunities from your CRM appear here." />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <caption className="sr-only">Opportunities</caption>
        <thead>
          <tr>
            {["Opportunity", "Type", "Stage", "Amount", "Close date", "Owner"].map((h) => (
              <th key={h} scope="col" className="text-label border-b border-border px-3 pt-3 pb-2.5 text-left whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.opportunities.map((o) => (
            <tr key={o.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5 font-semibold">{o.name}</td>
              <td className="px-3 py-2.5 capitalize">{o.type.replace("_", " ")}</td>
              <td className="px-3 py-2.5">
                <Pill tone={STAGE_TONE[o.stage] ?? "muted"}>{o.stage.replace("_", " ")}</Pill>
              </td>
              <td className="px-3 py-2.5 font-mono">{formatCurrency(o.amount)}</td>
              <td className="px-3 py-2.5 font-mono whitespace-nowrap">{o.closeDate ? formatDate(o.closeDate) : "—"}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{o.ownerName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function TasksPanel({ detail }: { detail: AccountDetail }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <SectionTitle icon={ListChecks} className="m-0" as="h3">
            Open ({detail.openWork.length})
          </SectionTitle>
          <Link href="/my-work?owner=all" className="text-xs font-semibold text-primary hover:underline">
            Manage in My Work
          </Link>
        </div>
        {detail.openWork.length === 0 ? (
          <EmptyState compact icon={ListChecks} title="Queue is clear" description="No open tasks, approvals or decisions for this account." />
        ) : (
          <ul className="mt-2 divide-y divide-border border-t border-border">
            {detail.openWork.map((w) => (
              <WorkRow key={w.id} item={w} />
            ))}
          </ul>
        )}
      </Card>
      <Card className="overflow-hidden">
        <SectionTitle icon={BadgeCheck} className="mx-4 mt-4 mb-0" as="h3">
          Recently completed
        </SectionTitle>
        {detail.completedWork.length === 0 ? (
          <EmptyState compact title="Nothing completed yet" />
        ) : (
          <ul className="mt-2 divide-y divide-border border-t border-border">
            {detail.completedWork.map((w) => (
              <WorkRow key={w.id} item={w} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function TimelinePanel({ detail }: { detail: AccountDetail }) {
  const entries = buildTimeline(detail);
  if (entries.length === 0) return <EmptyState icon={Activity} title="No history yet" description="Notes, activities, agent runs and health changes will appear here." />;
  return (
    <ol className="max-w-3xl">
      {entries.map((e, i) => {
        const Icon = TIMELINE_ICONS[e.icon] ?? Activity;
        const body = (
          <>
            <div className="text-[12.5px] font-semibold">{e.title}</div>
            <div className="font-mono text-[11px] text-foreground-faint">
              {formatRelativeTime(e.at)}
              {e.actor ? ` · ${e.actor}` : ""}
            </div>
            {e.detail && <p className="mt-1 line-clamp-3 text-[12.5px] text-foreground-muted">{e.detail}</p>}
          </>
        );
        return (
          <li key={e.id} className="relative flex gap-3 pb-[18px]">
            {i < entries.length - 1 && <span aria-hidden className="absolute top-6 bottom-[-4px] left-[13px] w-[1.5px] bg-border-strong" />}
            <span className="z-10 flex size-[27px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              {e.href ? (
                <Link href={e.href} className="block hover:text-primary">
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
