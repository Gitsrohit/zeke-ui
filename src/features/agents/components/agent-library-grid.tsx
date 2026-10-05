"use client";

import { Bot, Play, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getHealthSource, type HealthSourceKey } from "@/config/health";
import { EmptyState } from "@/components/shared/empty-state";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/utils/format";
import { LaunchAgentDialog } from "./launch-agent-dialog";

export interface AgentCardData {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "active" | "draft" | "archived";
  triggerType: "manual" | "audience" | "event";
  triggerLabel: string;
  targetMetric: HealthSourceKey;
  audienceId: string | null;
  audienceName: string | null;
  audienceMemberIds: string[] | null;
  stepCount: number;
  totalRuns: number;
  activeRuns: number;
  completionRate: number | null;
  orchestrated: boolean;
}

const TRIGGER_LABEL = { manual: "Manual", audience: "Audience", event: "Event" } as const;

export function AgentLibraryGrid({ agents, canLaunch, canManage }: { agents: AgentCardData[]; canLaunch: boolean; canManage: boolean }) {
  const [launching, setLaunching] = useState<AgentCardData | null>(null);

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Agents chain emails, tasks, waits, approvals and branches into sequences that run against your audiences."
          action={
            canManage ? (
              <Button asChild variant="accent" size="sm">
                <Link href="/agents/new">Create your first agent</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <li key={a.id} className="relative flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-4 transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-pop">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone="neutral">{a.category}</Pill>
              <Pill tone={a.status === "active" ? "thriving" : "muted"} dot>
                {a.status === "active" ? "Active" : "Draft"}
              </Pill>
            </div>
            <h3 className="text-[14.5px] font-semibold">
              <Link href={`/agents/${a.id}`} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-violet">
                {a.name}
              </Link>
            </h3>
            <p className="flex-1 text-[12.5px] text-foreground-muted">{a.description || "No description."}</p>
            <dl className="grid gap-1 text-xs">
              <div className="flex gap-1.5">
                <dt className="text-foreground-faint">Trigger:</dt>
                <dd className="truncate">
                  {TRIGGER_LABEL[a.triggerType]} · {a.triggerLabel}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-foreground-faint">Moves:</dt>
                <dd>{getHealthSource(a.targetMetric).name}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border pt-2.5 font-mono text-[11.5px] text-foreground-faint">
              <span>{pluralize(a.stepCount, "step")}</span>
              <span>{pluralize(a.totalRuns, "run")}</span>
              <span>{a.completionRate === null ? "—" : `${a.completionRate}% done`}</span>
              <span>
                {a.activeRuns} active{a.orchestrated ? " · orchestrated" : ""}
              </span>
            </div>
            {canLaunch && a.status === "active" && (
              <div className="relative z-10 flex items-center gap-2">
                {a.audienceMemberIds && a.audienceMemberIds.length > 0 ? (
                  <Button size="sm" variant="accent" onClick={() => setLaunching(a)}>
                    <Play /> Launch for {a.audienceName}
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/audiences">
                      <Target /> Choose an audience to launch
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {launching && (
        <LaunchAgentDialog
          open
          onOpenChange={(o) => !o && setLaunching(null)}
          accountIds={launching.audienceMemberIds ?? []}
          agents={[{ id: launching.id, name: launching.name, category: launching.category }]}
          defaultAgentId={launching.id}
          audienceId={launching.audienceId}
          sourceLabel={launching.audienceName ?? "Agent library"}
          description={`in ${launching.audienceName}`}
        />
      )}
    </>
  );
}
