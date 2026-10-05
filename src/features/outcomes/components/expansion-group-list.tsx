"use client";

import { Check, ChevronDown, ChevronRight, Eye, Play, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreBadge } from "@/components/shared/health-badge";
import { Button } from "@/components/ui/button";
import { LaunchAgentDialog, type LaunchableAgent } from "@/features/agents/components/launch-agent-dialog";
import type { getExpansionOverview } from "@/features/outcomes/services/outcome.service";
import { formatCurrency } from "@/lib/utils/format";
import { InsightBlock } from "./insight-block";

type ExpansionGroup = Awaited<ReturnType<typeof getExpansionOverview>>["groups"][number];

interface LaunchTarget {
  accountIds: string[];
  sourceLabel: string;
  description: string;
  defaultAgentId: string | null;
}

export function ExpansionGroupList({ groups, agents, canLaunch }: { groups: ExpansionGroup[]; agents: LaunchableAgent[]; canLaunch: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [launch, setLaunch] = useState<LaunchTarget | null>(null);

  if (groups.every((g) => g.accounts.length === 0)) {
    return (
      <Card>
        <EmptyState icon={TrendingUp} title="No expansion signals yet" description="Accounts appear here when they're thriving in Growth, renewing soon while healthy, or showing strong NPS." />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {groups.map((g) => {
        const open = expanded === g.key;
        const panelId = `expansion-${g.key}`;
        const empty = g.accounts.length === 0;
        return (
          <Card key={g.key} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-thriving-tint font-mono text-[17px] font-bold text-thriving" aria-label={`${g.accounts.length} accounts`}>
                  {g.accounts.length}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-[15.5px] font-bold">{g.label}</h2>
                  <p className="mt-0.5 max-w-[560px] text-[12.5px] text-foreground-muted">{g.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>
                      <span className="text-foreground-faint">Recommended agent:</span> {g.agent ? <b>{g.agent.name}</b> : <span className="text-foreground-muted">No agent configured</span>}
                    </span>
                    <span>
                      <span className="text-foreground-faint">Est. expansion:</span> <b className="font-mono text-thriving">+{formatCurrency(g.estimatedPotential)}</b>
                    </span>
                    <span>
                      <span className="text-foreground-faint">ARR in group:</span> <b className="font-mono">{formatCurrency(g.totalArr)}</b>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" aria-expanded={open} aria-controls={panelId} disabled={empty} onClick={() => setExpanded(open ? null : g.key)}>
                  {open ? <ChevronDown /> : <ChevronRight />}
                  {open ? "Hide accounts" : "View accounts"}
                </Button>
                {canLaunch && (
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={empty || agents.length === 0}
                    onClick={() => setLaunch({ accountIds: g.accounts.map((a) => a.id), sourceLabel: `Drive Outcome — ${g.label}`, description: `in ${g.label}`, defaultAgentId: g.agent?.id ?? null })}
                  >
                    <Play /> Launch {g.agent?.name ?? "agent"} for all {g.accounts.length}
                  </Button>
                )}
              </div>
            </div>
            <InsightBlock
              observed={g.observedSignal}
              inference={`Likely ready for expansion — the estimate uses a ${Math.round(g.rate * 100)}% illustrative rate on ARR, not deal data.`}
              action={g.agent ? `Run ${g.agent.name} to open the conversation before renewal forces it.` : "Create an expansion agent in Agents to work this group."}
            />
            {open && (
              <ul id={panelId} className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {g.accounts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AccountAvatar name={a.name} />
                      <div className="min-w-0">
                        <Link href={`/accounts/${a.id}`} className="block truncate text-[13px] font-semibold hover:underline">
                          {a.name}
                        </Link>
                        <div className="truncate text-[11.5px] text-foreground-faint">
                          {a.lifecycle} · {a.segment} · {a.ownerName ?? "Unassigned"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ScoreBadge score={a.healthScore} band={a.band} />
                      <span className="font-mono text-xs text-foreground-muted">{formatCurrency(a.arr)}</span>
                      <span className="font-mono text-xs text-foreground-muted">NPS {a.nps ?? "—"}</span>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/accounts/${a.id}`}>
                          <Eye /> View
                        </Link>
                      </Button>
                      {canLaunch && (
                        <Button variant="accent" size="sm" disabled={agents.length === 0} onClick={() => setLaunch({ accountIds: [a.id], sourceLabel: "Drive Outcome — Expansion (AI-recommended)", description: `(${a.name}) for ${g.label}`, defaultAgentId: g.agent?.id ?? null })}>
                          <Check /> Approve & launch
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      {launch && (
        <LaunchAgentDialog open onOpenChange={(o) => !o && setLaunch(null)} accountIds={launch.accountIds} sourceLabel={launch.sourceLabel} description={launch.description} defaultAgentId={launch.defaultAgentId} agents={agents} />
      )}
    </div>
  );
}
