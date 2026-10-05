import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { RecalculateButton } from "@/features/scorecards/components/recalculate-button";
import { ScorecardMatrix } from "@/features/scorecards/components/scorecard-matrix";
import { getScorecardMatrix } from "@/features/scorecards/services/scorecard.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { can } from "@/lib/server/context";

export const metadata: Metadata = { title: "Scorecards" };

export default async function ScorecardsPage() {
  const ctx = await getServiceContext();
  let items: Awaited<ReturnType<typeof getScorecardMatrix>>;
  try {
    items = await getScorecardMatrix(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  return (
    <>
      <PageHeader
        title="12 scorecards, one model"
        description="Every account is scored against the scorecard for its lifecycle stage and ARR segment — each with its own data-source weighting and health bands, tuned to what actually predicts health at that stage."
        actions={can(ctx, "scorecards.manage") ? <RecalculateButton /> : undefined}
      />
      <ScorecardMatrix items={items} />
    </>
  );
}
