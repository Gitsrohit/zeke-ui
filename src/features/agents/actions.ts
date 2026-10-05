"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { launchAgent, skipWait, stopRun } from "@/features/agents/services/agent-engine.service";
import { archiveAgent, saveAgent } from "@/features/agents/services/agent.service";
import { requireApiContext } from "@/lib/auth/session";
import { parseInput, runAction } from "@/lib/server/action";

const launchSchema = z.object({
  agentId: z.string().uuid("Choose an agent"),
  accountIds: z.array(z.string().uuid()).min(1, "No accounts selected").max(500),
  audienceId: z.string().uuid().nullable().optional(),
  sourceLabel: z.string().trim().min(1).max(120),
});

export async function launchAgentAction(input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const values = parseInput(launchSchema, input);
    const result = await launchAgent(ctx, values);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function saveAgentAction(input: unknown, agentId?: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await saveAgent(ctx, input, agentId);
    revalidatePath("/agents");
    return result;
  });
}

export async function archiveAgentAction(agentId: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await archiveAgent(ctx, agentId);
    revalidatePath("/agents");
  });
}

export async function stopRunAction(runId: string, reason: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await stopRun(ctx, runId, reason);
    revalidatePath("/", "layout");
  });
}

export async function skipWaitAction(runId: string) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    await skipWait(ctx, runId);
    revalidatePath("/", "layout");
  });
}
