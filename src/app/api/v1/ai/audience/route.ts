import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAudienceWithAI } from "@/features/audiences/services/audience.service";
import { requireApiContext } from "@/lib/auth/session";
import { parseInput } from "@/lib/server/action";
import { withApi } from "@/lib/server/route";

export const POST = withApi(async (request) => {
  const ctx = await requireApiContext();
  const { prompt } = parseInput(z.object({ prompt: z.string() }), await request.json());
  return NextResponse.json(await parseAudienceWithAI(ctx, prompt));
});
