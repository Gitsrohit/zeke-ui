import type { Metadata } from "next";
import { ArrowLeft, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHealthSource } from "@/config/health";
import { Card } from "@/components/shared/card";
import { ScoreBadge } from "@/components/shared/health-badge";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Pill } from "@/components/shared/pill";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import { RunActions } from "@/features/agents/components/run-actions";
import { Lift, OutcomePill, RunStatusPill, StepStatusPill } from "@/features/agents/components/run-status";
import { StepIcon } from "@/features/agents/components/step-style";
import { describeStepNode, STEP_TYPE_LABELS } from "@/features/agents/domain/steps";
import type { AgentStepNode } from "@/features/agents/domain/types";
import { getRunDetail } from "@/features/agents/services/agent.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { can } from "@/lib/server/context";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Agent run" };

function noteOf(detail: Record<string, unknown>): string | null {
  return typeof detail.note === "string" ? detail.note : null;
}

export default async function RunPage(props: PageProps<"/agents/runs/[runId]">) {
  const { runId } = await props.params;
  const ctx = await getServiceContext();
  let data;
  try {
    data = await getRunDetail(ctx, runId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  const { run, account, steps, executions, metricNow, scoreNow } = data;
  const metric = getHealthSource(run.targetMetric);
  const active = run.status === "active";
  const waiting = steps.some((s) => s.status === "waiting");
  const humanStep = steps.find((s) => s.status === "active");

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/agents">
          <ArrowLeft /> Agents
        </Link>
      </Button>
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">
                <Link href={`/agents/${run.agentId}`} className="hover:underline">
                  {run.agentName}
                </Link>
              </h1>
              <RunStatusPill status={run.status} />
              <OutcomePill outcome={run.outcome} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-foreground-faint">Account:</span>
              <Link href={`/accounts/${account.id}`} className="font-semibold hover:underline">
                {account.name}
              </Link>
              <ScoreBadge score={account.score} band={account.band} size="sm" />
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-foreground-faint">Source</dt>
                <dd>{run.sourceLabel}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-foreground-faint">Owner</dt>
                <dd>{run.ownerName ?? "Unassigned"}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-foreground-faint">Started</dt>
                <dd className="font-mono">{formatDateTime(run.startedAt)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-foreground-faint">{run.status === "stopped" ? "Stopped" : "Completed"}</dt>
                <dd className="font-mono">{run.completedAt ? formatDateTime(run.completedAt) : "—"}</dd>
              </div>
              {run.stoppedReason && (
                <div className="flex gap-1.5 sm:col-span-2">
                  <dt className="text-foreground-faint">Reason</dt>
                  <dd>{run.stoppedReason}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-[11px] text-foreground-faint">{metric.name}</div>
                <div className="font-mono text-sm font-semibold">
                  {run.metricAtLaunch} → {metricNow} (<Lift value={metricNow - run.metricAtLaunch} />)
                </div>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-[11px] text-foreground-faint">Health score</div>
                <div className="font-mono text-sm font-semibold">
                  {run.scoreAtLaunch} → {scoreNow} (<Lift value={scoreNow - run.scoreAtLaunch} />)
                </div>
              </div>
            </div>
            {active && can(ctx, "agents.manage") && <RunActions runId={run.id} waiting={waiting} />}
          </div>
        </div>
        {active && humanStep && (
          <p className="mt-4 flex flex-wrap items-center gap-2 rounded-md bg-violet-tint px-3 py-2 text-[12.5px] text-violet-deep">
            <ListChecks className="size-4" aria-hidden /> Waiting on a person: {describeStepNode(humanStep as Pick<AgentStepNode, "type" | "config">)}.
            <Link href="/my-work" className="font-semibold underline">
              Open My Work
            </Link>
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="steps-heading">
          <SectionTitle className="mt-0" as="h2">
            <span id="steps-heading">Steps</span>
          </SectionTitle>
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[14px] w-0.5 bg-border-strong" />}
                <StepIcon type={s.type} />
                <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-semibold">{STEP_TYPE_LABELS[s.type]}</span>
                    <StepStatusPill status={s.status} />
                    {s.branchTaken && <Pill tone={s.branchTaken === "yes" ? "thriving" : "critical"}>Took “{s.branchTaken}”</Pill>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-foreground-muted">{describeStepNode(s as Pick<AgentStepNode, "type" | "config">)}</p>
                  <p className="mt-1 font-mono text-[11px] text-foreground-faint">
                    {s.status === "waiting" && s.dueAt ? `Resumes ${formatRelativeTime(s.dueAt)} (${formatDateTime(s.dueAt)})` : null}
                    {s.status === "completed" && s.completedAt ? `Done ${formatRelativeTime(s.completedAt)}${s.completedByName ? ` by ${s.completedByName}` : " automatically"}` : null}
                    {s.status === "active" && s.startedAt ? `Waiting since ${formatRelativeTime(s.startedAt)}` : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="exec-heading">
          <SectionTitle className="mt-0" as="h2">
            <span id="exec-heading">Automated actions</span>
          </SectionTitle>
          <Card>
            {executions.length === 0 ? (
              <p className="p-4 text-[12.5px] text-foreground-faint">No automated actions have run yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {executions.map((e) => (
                  <li key={e.id} className="px-4 py-3 text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{e.action}</span>
                      <Pill tone={e.status === "failed" ? "critical" : "muted"}>{e.status}</Pill>
                      <span className="ml-auto font-mono text-[11px] text-foreground-faint">{formatRelativeTime(e.executedAt)}</span>
                    </div>
                    {typeof e.detail.template === "string" && <p className="mt-0.5 text-foreground-muted">{e.detail.template}</p>}
                    {typeof e.detail.endpoint === "string" && (
                      <p className="mt-0.5 font-mono text-[11.5px] text-foreground-muted">
                        {String(e.detail.method ?? "")} {e.detail.endpoint}
                      </p>
                    )}
                    {noteOf(e.detail) && <p className="mt-1 text-[11.5px] text-foreground-faint">{noteOf(e.detail)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
