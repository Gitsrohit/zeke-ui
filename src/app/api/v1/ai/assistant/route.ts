import { NextResponse } from "next/server";
import { askAssistant, assistantQuestionSchema } from "@/features/ai/services/assistant.service";
import { requireApiContext } from "@/lib/auth/session";
import { parseInput } from "@/lib/server/action";
import { withApi } from "@/lib/server/route";

export const POST = withApi(async (request) => {
  const ctx = await requireApiContext();
  const { question } = parseInput(assistantQuestionSchema, await request.json());
  return NextResponse.json(await askAssistant(ctx, question));
});
