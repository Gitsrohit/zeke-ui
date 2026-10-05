import { NextResponse } from "next/server";
import { z } from "zod";
import { previewLaunch } from "@/features/agents/services/agent-engine.service";
import { requireApiContext } from "@/lib/auth/session";
import { parseInput } from "@/lib/server/action";
import { withApi } from "@/lib/server/route";

export const POST = withApi(async (request) => {
  const ctx = await requireApiContext();
  const { agentId, accountIds } = parseInput(z.object({ agentId: z.string().uuid(), accountIds: z.array(z.string().uuid()).min(1).max(500) }), await request.json());
  return NextResponse.json(await previewLaunch(ctx, agentId, accountIds));
});
