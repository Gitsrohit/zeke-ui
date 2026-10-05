import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { AgentBuilder } from "@/features/agents/components/agent-builder";
import { loadBuilderLookups } from "@/features/agents/components/builder-data";
import { getAgentForBuilder } from "@/features/agents/services/agent.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { can } from "@/lib/server/context";

export const metadata: Metadata = { title: "Agent builder" };

export default async function AgentPage(props: PageProps<"/agents/[agentId]">) {
  const { agentId } = await props.params;
  const ctx = await getServiceContext();
  let data;
  try {
    data = await getAgentForBuilder(ctx, agentId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  const { agent, steps } = data;
  const lookups = await loadBuilderLookups(ctx, agent.id, agent.audienceId);
  return (
    <AgentBuilder
      key={agent.currentVersionId ?? agent.id}
      agent={{
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        status: agent.status,
        triggerType: agent.triggerType,
        triggerLabel: agent.triggerLabel,
        targetMetric: agent.targetMetric,
        audienceId: agent.audienceId,
        cooldownDays: agent.cooldownDays,
        maxAttempts: agent.maxAttempts,
        eligibleLifecycles: agent.eligibleLifecycles,
        conflictsWith: agent.conflictsWith,
      }}
      initialSteps={steps}
      otherAgents={lookups.otherAgents}
      audiences={lookups.audiences}
      canManage={can(ctx, "agents.manage")}
      canLaunch={can(ctx, "agents.launch")}
      launchTarget={lookups.launchTarget}
    />
  );
}
