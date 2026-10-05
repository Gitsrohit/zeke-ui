import "server-only";
import { listAgents } from "@/features/agents/repositories/agent.repository";
import { listAudienceSummaries, resolveAudienceMembers } from "@/features/audiences/services/audience.service";
import { db } from "@/lib/db";
import type { ServiceContext } from "@/lib/server/context";

/** Lookups the builder needs: other agents (for conflicts), audiences, and the attached audience's members. */
export async function loadBuilderLookups(ctx: ServiceContext, agentId: string | null, audienceId: string | null) {
  const [agents, audiences] = await Promise.all([listAgents(db, ctx.organizationId), listAudienceSummaries(ctx)]);
  let launchTarget: { audienceId: string; audienceName: string; memberIds: string[] } | null = null;
  if (audienceId) {
    try {
      const { audience, members } = await resolveAudienceMembers(ctx, audienceId);
      launchTarget = { audienceId, audienceName: audience.name, memberIds: members.map((m) => m.id) };
    } catch {
      launchTarget = null;
    }
  }
  return {
    otherAgents: agents.filter((a) => a.id !== agentId).map((a) => ({ id: a.id, name: a.name })),
    audiences: audiences.map((a) => ({ id: a.id, name: a.name, memberCount: a.memberCount })),
    launchTarget,
  };
}
