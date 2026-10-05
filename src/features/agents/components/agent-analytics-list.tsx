"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { getHealthSource, type HealthSourceKey } from "@/config/health";
import { Card } from "@/components/shared/card";
import { Chip, Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import type { AgentRunOutcome, AgentRunStatus } from "@/features/agents/domain/types";
import { formatRelativeTime, pluralize } from "@/lib/utils/format";
import { Lift, OutcomePill, RunStatusPill } from "./run-status";

export interface AnalyticsAgent {
  agent: { id: string; name: string; category: string; targetMetric: HealthSourceKey; status: string };
  summary: { totalRuns: number; completionRate: number; successRate: number; failureRate: number; avgMetricLift: number; avgScoreLift: number };
  runs: Array<{
    id: string;
    accountId: string;
    accountName: string;
    status: AgentRunStatus;
    outcome: AgentRunOutcome | null;
    startedAt: string;
    metricAtLaunch: number;
    metricNow: number;
    metricLift: number;
    scoreAtLaunch: number;
    scoreNow: number;
    scoreLift: number;
  }>;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-foreground-faint">{label}</div>
      <div className="font-mono text-[17px] font-bold tabular">{children}</div>
    </div>
  );
}

export function AgentAnalyticsList({ agents }: { agents: AnalyticsAgent[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3.5">
      {agents.map(({ agent, summary, runs }) => {
        const expanded = open === agent.id;
        const metric = getHealthSource(agent.targetMetric);
        return (
          <Card key={agent.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/agents/${agent.id}`} className="font-display text-[15px] font-bold hover:underline">
                    {agent.name}
                  </Link>
                  <Pill tone="neutral">{agent.category}</Pill>
                  {agent.status !== "active" && <Pill tone="muted">{agent.status}</Pill>}
                  <Chip>Tracks: {metric.name}</Chip>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-3">
                  <Stat label="Runs">{summary.totalRuns}</Stat>
                  <Stat label="Completion rate">{summary.totalRuns ? `${summary.completionRate}%` : "—"}</Stat>
                  <Stat label={`Avg ${metric.shortName} lift`}>
                    <Lift value={summary.avgMetricLift} decimals={1} suffix=" pts" />
                  </Stat>
                  <Stat label="Avg health score lift">
                    <Lift value={summary.avgScoreLift} decimals={1} suffix=" pts" />
                  </Stat>
                  <Stat label="Success / failure">{summary.totalRuns ? `${summary.successRate}% / ${summary.failureRate}%` : "—"}</Stat>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={runs.length === 0} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : agent.id)}>
                {expanded ? <ChevronDown /> : <ChevronRight />}
                {expanded ? "Hide runs" : `View ${pluralize(runs.length, "run")}`}
              </Button>
            </div>
            {expanded && (
              <div className="mt-4 overflow-x-auto border-t border-border pt-3.5 scrollbar-thin">
                <table className="w-full text-[13px]">
                  <caption className="sr-only">Runs of {agent.name}</caption>
                  <thead>
                    <tr>
                      {["Account", "Status", "Outcome", metric.name, "Health score", "Started", ""].map((h) => (
                        <th key={h} scope="col" className="text-label border-b border-border px-2.5 pb-2 text-left whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-2.5 py-2.5">
                          <Link href={`/accounts/${r.accountId}`} className="font-semibold hover:underline">
                            {r.accountName}
                          </Link>
                        </td>
                        <td className="px-2.5 py-2.5">
                          <RunStatusPill status={r.status} />
                        </td>
                        <td className="px-2.5 py-2.5">
                          <OutcomePill outcome={r.outcome} />
                        </td>
                        <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                          {r.metricAtLaunch} → {r.metricNow} (<Lift value={r.metricLift} />)
                        </td>
                        <td className="px-2.5 py-2.5 font-mono whitespace-nowrap">
                          {r.scoreAtLaunch} → {r.scoreNow} (<Lift value={r.scoreLift} />)
                        </td>
                        <td className="px-2.5 py-2.5 font-mono whitespace-nowrap text-foreground-faint">{formatRelativeTime(r.startedAt)}</td>
                        <td className="px-2.5 py-2.5 text-right">
                          <Link href={`/agents/runs/${r.id}`} className="text-xs font-semibold text-primary hover:underline">
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
