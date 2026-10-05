"use client";

import { Check, ChevronDown, ChevronRight, Eye, Play, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/shared/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { ScoreBadge } from "@/components/shared/health-badge";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LaunchAgentDialog, type LaunchableAgent } from "@/features/agents/components/launch-agent-dialog";
import type { getRiskOverview } from "@/features/outcomes/services/outcome.service";
import { formatCurrency, pluralize } from "@/lib/utils/format";
import { dismissRiskAction } from "../actions";
import { InsightBlock } from "./insight-block";

type RiskGroup = Awaited<ReturnType<typeof getRiskOverview>>["groups"][number];
type RiskAccount = RiskGroup["accounts"][number];

interface LaunchTarget {
  accountIds: string[];
  sourceLabel: string;
  description: string;
  defaultAgentId: string | null;
}

interface RiskGroupListProps {
  groups: RiskGroup[];
  agents: LaunchableAgent[];
  dismissedCount: number;
  canLaunch: boolean;
  canDismiss: boolean;
}

export function RiskGroupList({ groups, agents, dismissedCount, canLaunch, canDismiss }: RiskGroupListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [launch, setLaunch] = useState<LaunchTarget | null>(null);
  const [dismissing, setDismissing] = useState<RiskAccount | null>(null);

  const visible = groups
    .map((g) => ({ ...g, accounts: g.accounts.filter((a) => !hidden.has(a.id)) }))
    .filter((g) => g.accounts.length > 0);

  return (
    <>
      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Nothing flagged right now"
            description="Zeke groups accounts here by risk type the moment a health score drops into At Risk or Critical, or predictive risk diverges from the score."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {visible.map((g) => {
            const open = expanded === g.source;
            const panelId = `risk-${g.source}`;
            return (
              <Card key={g.source} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-critical-tint font-mono text-[17px] font-bold text-critical" aria-label={`${g.accounts.length} accounts`}>
                      {g.accounts.length}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-[15.5px] font-bold">{g.label}</h2>
                      <p className="mt-0.5 max-w-[560px] text-[12.5px] text-foreground-muted">{g.description}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span>
                          <span className="text-foreground-faint">ARR exposed:</span> <b className="font-mono">{formatCurrency(g.accounts.reduce((s, a) => s + a.arr, 0))}</b>
                        </span>
                        <span>
                          <span className="text-foreground-faint">Recommended agent:</span> {g.agent ? <b>{g.agent.name}</b> : <span className="text-foreground-muted">No agent configured</span>}
                        </span>
                      </div>
                      <p className="mt-1.5 max-w-[620px] text-xs text-foreground-muted">
                        <span className="text-foreground-faint">Recommended action:</span> {g.recommendedAction}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setExpanded(open ? null : g.source)}>
                      {open ? <ChevronDown /> : <ChevronRight />}
                      {open ? "Hide accounts" : "Review accounts"}
                    </Button>
                    {canLaunch && (
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={agents.length === 0}
                        onClick={() =>
                          setLaunch({
                            accountIds: g.accounts.map((a) => a.id),
                            sourceLabel: `Drive Outcome — ${g.label}`,
                            description: `flagged for ${g.label}`,
                            defaultAgentId: g.agent?.id ?? null,
                          })
                        }
                      >
                        <Play /> Launch {g.agent?.name ?? "agent"} for all {g.accounts.length}
                      </Button>
                    )}
                  </div>
                </div>
                {open && (
                  <ul id={panelId} className="mt-4 flex flex-col gap-2.5 border-t border-border pt-4">
                    {g.accounts.map((a) => (
                      <li key={a.id} className="rounded-lg bg-surface-muted p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <AccountAvatar name={a.name} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={`/accounts/${a.id}`} className="truncate text-[13px] font-semibold hover:underline">
                                  {a.name}
                                </Link>
                                {a.risingRisk && <Pill tone="atRisk" dot>rising risk</Pill>}
                              </div>
                              <div className="truncate text-[11.5px] text-foreground-faint">
                                {a.lifecycle} · {a.segment} · {a.ownerName ?? "Unassigned"} · {formatCurrency(a.arr)}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <ScoreBadge score={a.healthScore} band={a.band} />
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/accounts/${a.id}`}>
                                <Eye /> View
                              </Link>
                            </Button>
                            {canDismiss && (
                              <Button variant="outline" size="sm" onClick={() => setDismissing(a)}>
                                <X /> Dismiss
                              </Button>
                            )}
                            {canLaunch && (
                              <Button
                                variant="accent"
                                size="sm"
                                disabled={agents.length === 0}
                                onClick={() =>
                                  setLaunch({
                                    accountIds: [a.id],
                                    sourceLabel: "Drive Outcome — AI recommendation",
                                    description: `(${a.name}) as recommended for ${g.label}`,
                                    defaultAgentId: a.recommendedAgent?.id ?? g.agent?.id ?? null,
                                  })
                                }
                              >
                                <Check /> Approve & launch
                              </Button>
                            )}
                          </div>
                        </div>
                        <InsightBlock observed={a.observedSignal} inference={a.inference} action={`${g.recommendedAction}${a.recommendedAgent ? ` Suggested agent: ${a.recommendedAgent.name}.` : ""}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {dismissedCount > 0 && (
        <p className="mt-4 text-[11.5px] text-foreground-faint">
          {pluralize(dismissedCount, "account")} currently dismissed. Dismissals expire automatically, so accounts return here if the risk persists.
        </p>
      )}
      {launch && (
        <LaunchAgentDialog
          open
          onOpenChange={(o) => !o && setLaunch(null)}
          accountIds={launch.accountIds}
          sourceLabel={launch.sourceLabel}
          description={launch.description}
          defaultAgentId={launch.defaultAgentId}
          agents={agents}
        />
      )}
      {dismissing && (
        <DismissDialog
          account={dismissing}
          onClose={() => setDismissing(null)}
          onDismissed={(id) => setHidden((h) => new Set(h).add(id))}
          onRestore={(id) =>
            setHidden((h) => {
              const next = new Set(h);
              next.delete(id);
              return next;
            })
          }
        />
      )}
    </>
  );
}

function DismissDialog({ account, onClose, onDismissed, onRestore }: { account: RiskAccount; onClose: () => void; onDismissed: (id: string) => void; onRestore: (id: string) => void }) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("30");
  const [pending, startTransition] = useTransition();
  const confirm = () =>
    startTransition(async () => {
      onDismissed(account.id);
      const result = await dismissRiskAction({ accountId: account.id, days: Number(days), reason: reason.trim() || undefined });
      if (!result.ok) {
        onRestore(account.id);
        toast.error(result.error);
        return;
      }
      toast.success(`${account.name} dismissed for ${days} days.`);
      onClose();
    });
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Dismiss ${account.name}?`}
      description="It will be hidden from risk recommendations for the period you choose, then reappear if the risk persists. This is recorded in the audit log."
      confirmLabel="Dismiss"
      confirmIcon={<X />}
      loading={pending}
      onConfirm={confirm}
    >
      <div className="grid gap-3">
        <div>
          <label htmlFor="dismiss-days" className="mb-1.5 block text-xs font-semibold text-foreground-muted">
            Dismiss for
          </label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger id="dismiss-days" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="dismiss-reason" className="mb-1.5 block text-xs font-semibold text-foreground-muted">
            Reason (optional)
          </label>
          <Textarea id="dismiss-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Already handled in this week's QBR" />
        </div>
      </div>
    </ConfirmDialog>
  );
}
