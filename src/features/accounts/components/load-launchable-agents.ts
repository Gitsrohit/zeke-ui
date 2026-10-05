import "server-only";
import { getAgentLibrary } from "@/features/agents/services/agent.service";
import type { LaunchableAgent } from "@/features/agents/components/launch-agent-dialog";
import { can, type ServiceContext } from "@/lib/server/context";

/** Active agents the viewer may launch (empty when they lack agents.launch). */
export async function loadLaunchableAgents(ctx: ServiceContext): Promise<LaunchableAgent[]> {
  if (!can(ctx, "agents.launch")) return [];
  const library = await getAgentLibrary(ctx);
  return library.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name, category: a.category }));
}
