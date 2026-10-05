import type { Metadata } from "next";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { getAgentLibrary } from "@/features/agents/services/agent.service";
import { ExpansionGroupList } from "@/features/outcomes/components/expansion-group-list";
import { RiskGroupList } from "@/features/outcomes/components/risk-group-list";
import { TabLinks } from "@/features/outcomes/components/tab-links";
import { getExpansionOverview, getRiskOverview } from "@/features/outcomes/services/outcome.service";
import { getServiceContext } from "@/lib/auth/session";
import { loadOrDeny } from "@/features/outcomes/components/load";
import { can } from "@/lib/server/context";
import { formatCurrency } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Drive Outcome" };

export default async function OutcomesPage({ searchParams }: PageProps<"/outcomes">) {
  const params = await searchParams;
  const tab = params.tab === "expansion" ? "expansion" : "risk";
  const ctx = await getServiceContext();

  const data = await loadOrDeny(async () => {
    const library = await getAgentLibrary(ctx);
    const agents = library.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name, category: a.category }));
    if (tab === "expansion") return { agents, expansion: await getExpansionOverview(ctx), risk: null };
    return { agents, expansion: null, risk: await getRiskOverview(ctx) };
  });
  if (!data) return <PermissionDenied permission="accounts.read" />;
  const permissions = { canLaunch: can(ctx, "agents.launch"), canDismiss: can(ctx, "accounts.write") };
  const { agents } = data;

  const header = (
    <>
      <PageHeader
        title="Drive outcomes, not just alerts"
        description="Every flagged risk and every expansion signal, grouped by type with the agent built to work it. Review by group or by account — nothing launches without your approval."
      />
      <TabLinks
        label="Outcome type"
        tabs={[
          { href: "/outcomes?tab=risk", label: "Manage Risk", active: tab === "risk" },
          { href: "/outcomes?tab=expansion", label: "Expansion", active: tab === "expansion" },
        ]}
      />
    </>
  );

  if (data.expansion) {
    const overview = data.expansion;
    return (
      <>
        {header}
        <KpiGrid className="lg:grid-cols-3">
          <KpiCard label="Opportunity types" value={overview.groups.length} detail="each linked to an agent" />
          <KpiCard label="Accounts flagged" value={overview.uniqueAccounts} detail="may appear in more than one type" />
          <KpiCard label="Estimated pipeline" value={formatCurrency(overview.totalPotential)} valueClassName="text-thriving" detail="illustrative — connect billing data for real figures" />
        </KpiGrid>
        <ExpansionGroupList groups={overview.groups} agents={agents} canLaunch={permissions.canLaunch} />
      </>
    );
  }

  const overview = data.risk!;
  const accounts = overview.groups.flatMap((g) => g.accounts);
  const atRiskArr = overview.groups.reduce((s, g) => s + g.totalArr, 0);
  return (
    <>
      {header}
      <KpiGrid>
        <KpiCard label="Flagged accounts" value={accounts.length} detail="at risk, critical or rising risk" valueClassName={accounts.length ? "text-at-risk" : undefined} />
        <KpiCard label="ARR at risk" value={formatCurrency(atRiskArr)} valueClassName={atRiskArr ? "text-critical" : undefined} detail="across flagged accounts" />
        <KpiCard label="Risk types" value={overview.groups.length} detail="grouped by biggest health drag" />
        <KpiCard label="Rising risk" value={accounts.filter((a) => a.risingRisk).length} detail="predictive risk well below score" />
      </KpiGrid>
      <RiskGroupList groups={overview.groups} agents={agents} dismissedCount={overview.dismissedCount} {...permissions} />
    </>
  );
}
