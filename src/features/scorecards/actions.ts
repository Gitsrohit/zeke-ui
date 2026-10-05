"use server";

import { revalidatePath } from "next/cache";
import { recalculateAll, updateScorecard } from "@/features/scorecards/services/scorecard.service";
import { requireApiContext } from "@/lib/auth/session";
import { runAction } from "@/lib/server/action";

export async function updateScorecardAction(scorecardId: string, input: unknown) {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await updateScorecard(ctx, scorecardId, input);
    revalidatePath("/scorecards", "layout");
    revalidatePath("/dashboard");
    return { version: result.version, scoresChanged: result.scoresChanged, bandChanges: result.bandChanges.length };
  });
}

export async function recalculateAllAction() {
  return runAction(async () => {
    const ctx = await requireApiContext();
    const result = await recalculateAll(ctx);
    revalidatePath("/", "layout");
    return { accountsProcessed: result.accountsProcessed, scoresChanged: result.scoresChanged, bandChanges: result.bandChanges.length };
  });
}
