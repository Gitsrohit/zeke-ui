import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Button } from "@/components/ui/button";
import { AgentLibraryGrid, type AgentCardData } from "@/features/agents/components/agent-library-grid";
import { AgentsSubnav } from "@/features/agents/components/agents-subnav";
import { getAgentLibrary } from "@/features/agents/services/agent.service";
import { resolveAudienceMembers } from "@/features/audiences/services/audience.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { can } from "@/lib/server/context";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const ctx = await getServiceContext();
  let library;
  try {
    library = await getAgentLibrary(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }

  const audienceIds = [...new Set(library.filter((a) => a.audienceId && a.status === "active").map((a) => a.audienceId!))];
  const members = new Map<string, string[]>();
  await Promise.all(
    audienceIds.map(async (id) => {
      try {
        const { members: list } = await resolveAudienceMembers(ctx, id);
        members.set(id, list.map((m) => m.id));
      } catch {
        // Audience may have been deleted — the card falls back to "choose an audience".
      }
    }),
  );

  const agents: AgentCardData[] = library.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    status: a.status,
    triggerType: a.triggerType,
    triggerLabel: a.triggerLabel,
    targetMetric: a.targetMetric,
    audienceId: a.audienceId,
    audienceName: a.audienceName,
    audienceMemberIds: a.audienceId ? (members.get(a.audienceId) ?? null) : null,
    stepCount: a.stepCount,
    totalRuns: a.totalRuns,
    activeRuns: a.activeRuns,
    completionRate: a.completionRate,
    orchestrated: a.conflictsWith.length > 0,
  }));
  const canManage = can(ctx, "agents.manage");

  return (
    <>
      <PageHeader
        title="Sequences that run themselves"
        description="Emails, tasks, waits, approvals and conditional branches — chained into agents, orchestrated so accounts never get double-booked, and launched against any saved audience."
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/agents/new">
                <Plus /> New agent
              </Link>
            </Button>
          ) : undefined
        }
      />
      <AgentsSubnav />
      <AgentLibraryGrid agents={agents} canLaunch={can(ctx, "agents.launch")} canManage={canManage} />
    </>
  );
}
