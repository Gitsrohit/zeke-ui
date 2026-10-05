import { z } from "zod";
import { listAccountFacts } from "@/features/accounts/services/account.service";
import { getAIProvider } from "@/features/ai";
import type { AssistantAnswer } from "@/features/ai/types";
import { listOrgUsers } from "@/features/users/repositories/user.repository";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { assertPermission, type ServiceContext } from "@/lib/server/context";

export const assistantQuestionSchema = z.object({ question: z.string().trim().min(2, "Ask a question").max(500) });

/** Answers questions about the accounts the user can see. Read-only: suggestions are navigation links, never actions. */
export async function askAssistant(ctx: ServiceContext, question: string): Promise<AssistantAnswer> {
  assertPermission(ctx, "accounts.read");
  rateLimit(`ai:${ctx.userId}`, 30, 60_000);
  const [accounts, owners] = await Promise.all([listAccountFacts(ctx), listOrgUsers(db, ctx.organizationId)]);
  return getAIProvider().answerQuestion(question, { accounts, owners, userName: ctx.userName });
}
