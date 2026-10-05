import type { Metadata } from "next";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { AgentBuilder, NEW_AGENT } from "@/features/agents/components/agent-builder";
import { loadBuilderLookups } from "@/features/agents/components/builder-data";
import { getServiceContext } from "@/lib/auth/session";
import { can } from "@/lib/server/context";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage() {
  const ctx = await getServiceContext();
  if (!can(ctx, "agents.manage")) return <PermissionDenied permission="agents.manage" description="Creating agents requires permission to manage agents." />;
  const lookups = await loadBuilderLookups(ctx, null, null);
  return <AgentBuilder agent={NEW_AGENT} initialSteps={[]} otherAgents={lookups.otherAgents} audiences={lookups.audiences} canManage canLaunch={can(ctx, "agents.launch")} launchTarget={null} />;
}
