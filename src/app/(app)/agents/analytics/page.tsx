import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { SectionTitle } from "@/components/shared/section-title";
import { AgentAnalyticsList } from "@/features/agents/components/agent-analytics-list";
import { AgentsSubnav } from "@/features/agents/components/agents-subnav";
import { getAgentAnalytics } from "@/features/agents/services/agent.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { formatSigned } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Agent analytics" };

export default async function AgentAnalyticsPage() {
  const ctx = await getServiceContext();
  let analytics;
  try {
    analytics = await getAgentAnalytics(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  const { overall, perAgent } = analytics;
  const withRuns = perAgent.filter((a) => a.summary.totalRuns > 0);

  return (
    <>
      <PageHeader title="Is automation moving the needle?" description="Every agent is tagged with the health metric it is built to move. Lift is computed live: the account's current metric minus the value captured the moment the agent launched." />
      <AgentsSubnav />
      {overall.totalRuns === 0 ? (
        <Card>
          <EmptyState icon={BarChart3} title="No agent runs yet" description="Launch an agent against an audience and its performance will appear here." />
        </Card>
      ) : (
        <>
          <KpiGrid className="lg:grid-cols-4">
            <KpiCard label="Total agent runs" value={overall.totalRuns} detail={`${overall.completedRuns} completed · ${overall.activeRuns} active`} />
            <KpiCard label="Completion rate" value={`${overall.completionRate}%`} detail={`Failure / stopped ${overall.failureRate}%`} />
            <KpiCard label="Accounts affected" value={overall.accountsAffected} detail="received at least one run" />
            <KpiCard label="Positive metric lift" value={`${overall.successRate}%`} valueClassName="text-thriving" detail={`${overall.positiveLiftCount} runs improved their target metric`} />
          </KpiGrid>
          <KpiGrid className="-mt-2 lg:grid-cols-3">
            <KpiCard label="Avg health score lift" value={formatSigned(overall.avgScoreLift, 1)} valueClassName={overall.avgScoreLift >= 0 ? "text-thriving" : "text-critical"} detail="points per account run" />
            <KpiCard label="Avg target-metric lift" value={formatSigned(overall.avgMetricLift, 1)} valueClassName={overall.avgMetricLift >= 0 ? "text-thriving" : "text-critical"} detail="points per run" />
            <KpiCard label="Success / failure rate" value={`${overall.successRate}% / ${overall.failureRate}%`} detail="improved metric vs stopped or failed" />
          </KpiGrid>
          <Card className="p-4">
            <HorizontalBarChart
              title="Average target-metric lift by agent"
              subtitle="points, current value minus value at launch"
              label={`Average target-metric lift by agent: ${withRuns.map((a) => `${a.agent.name} ${formatSigned(a.summary.avgMetricLift, 1)}`).join(", ")}`}
              valueLabel="Avg lift (pts)"
              format="signed1"
              rows={withRuns.map((a) => ({ label: a.agent.name, value: Number(a.summary.avgMetricLift.toFixed(1)), detail: `${a.summary.totalRuns} runs` }))}
            />
          </Card>
          <SectionTitle>Per agent</SectionTitle>
          <AgentAnalyticsList agents={perAgent} />
        </>
      )}
    </>
  );
}
