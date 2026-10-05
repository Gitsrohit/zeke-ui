import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Button } from "@/components/ui/button";
import { getAccountFilterOptions } from "@/features/accounts/services/account.service";
import { getAgentLibrary } from "@/features/agents/services/agent.service";
import { AudienceLibrary, type AudienceCard } from "@/features/audiences/components/audience-library";
import { describeCondition, flattenConditions } from "@/features/audiences/domain/evaluate";
import { listAudienceSummaries } from "@/features/audiences/services/audience.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { can } from "@/lib/server/context";

export const metadata: Metadata = { title: "Audience Creator" };

export default async function AudiencesPage() {
  const ctx = await getServiceContext();
  let data;
  try {
    data = await Promise.all([listAudienceSummaries(ctx), getAccountFilterOptions(ctx), getAgentLibrary(ctx)]);
  } catch (error) {
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  const [audiences, options, agents] = data;
  const ownerNames = Object.fromEntries(options.owners.map((o) => [o.id, o.name]));
  const canManage = can(ctx, "audiences.manage");
  const cards: AudienceCard[] = audiences.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    type: a.type,
    chips: flattenConditions(a.filter).slice(0, 3).map((c) => describeCondition(c, { ownerNames })),
    conditionCount: a.conditionCount,
    groupCount: a.filter.groups.length,
    memberCount: a.memberCount,
    lastEvaluatedAt: a.lastEvaluatedAt?.toISOString() ?? null,
    createdByName: a.createdByName,
  }));

  return (
    <>
      <PageHeader
        title="Build the right list, not another spreadsheet"
        description="Save every audience to the library for quick reuse, filter manually with AND/OR logic, or describe who you want in plain language."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/audiences/new">
                <Plus /> New audience
              </Link>
            </Button>
          )
        }
      />
      <AudienceLibrary
        audiences={cards}
        agents={agents.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name, category: a.category }))}
        canManage={canManage}
        canLaunch={can(ctx, "agents.launch")}
      />
    </>
  );
}
