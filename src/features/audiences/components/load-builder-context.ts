import "server-only";
import { getAccountFilterOptions, listAccountFacts } from "@/features/accounts/services/account.service";
import { getAgentLibrary } from "@/features/agents/services/agent.service";
import { can, type ServiceContext } from "@/lib/server/context";
import type { BuilderContext } from "./types";

/** Server-side data every audience builder needs: owner options, launchable agents and permissions. */
export async function loadBuilderContext(ctx: ServiceContext): Promise<BuilderContext> {
  const [options, agents, facts] = await Promise.all([getAccountFilterOptions(ctx), getAgentLibrary(ctx), listAccountFacts(ctx)]);
  return {
    owners: options.owners,
    agents: agents.filter((a) => a.status === "active").map((a) => ({ id: a.id, name: a.name, category: a.category })),
    canManage: can(ctx, "audiences.manage"),
    canLaunch: can(ctx, "agents.launch"),
    totalAccounts: facts.length,
  };
}
