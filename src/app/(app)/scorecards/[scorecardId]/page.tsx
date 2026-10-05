import { ArrowLeft, Building2, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HEALTH_BANDS } from "@/config/health";
import { Card } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Pill } from "@/components/shared/pill";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import { ScorecardAccountsTable } from "@/features/scorecards/components/scorecard-accounts-table";
import { ScorecardEditor } from "@/features/scorecards/components/scorecard-editor";
import { getScorecardDetail } from "@/features/scorecards/services/scorecard.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { can } from "@/lib/server/context";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Scorecard" };

export default async function ScorecardPage({ params }: PageProps<"/scorecards/[scorecardId]">) {
  const { scorecardId } = await params;
  const ctx = await getServiceContext();
  let detail: Awaited<ReturnType<typeof getScorecardDetail>>;
  try {
    detail = await getScorecardDetail(ctx, scorecardId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  const { scorecard, accounts, history } = detail;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/scorecards">
          <ArrowLeft /> All scorecards
        </Link>
      </Button>
      <PageHeader
        title={`${scorecard.lifecycle} · ${scorecard.segment}`}
        description={scorecard.note}
        actions={
          <span className="flex items-center gap-2 text-xs text-foreground-faint">
            <Pill>v{scorecard.version}</Pill>
            effective {formatDate(scorecard.effectiveFrom)}
            {scorecard.updatedByName ? ` · by ${scorecard.updatedByName}` : ""}
          </span>
        }
      />
      <ScorecardEditor
        key={scorecard.versionId}
        scorecardId={scorecard.scorecardId}
        lifecycle={scorecard.lifecycle}
        weights={scorecard.weights}
        thresholds={scorecard.thresholds}
        canManage={can(ctx, "scorecards.manage")}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, score: a.score, band: a.band }))}
      />

      <SectionTitle icon={Building2}>Accounts on this scorecard ({accounts.length})</SectionTitle>
      <ScorecardAccountsTable accounts={accounts} />

      <SectionTitle icon={History} hint="every change creates a new immutable version">
        Version history
      </SectionTitle>
      <Card>
        <ol>
          {history.map((v) => (
            <li key={v.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-border px-4 py-3 last:border-0">
              <Pill tone={v.isActive ? "violet" : "muted"}>v{v.version}{v.isActive ? " · active" : ""}</Pill>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{v.changeNote || "No note"}</div>
                <div className="font-mono text-[11px] text-foreground-faint">
                  {v.createdByName ?? "Zeke"} · saved {formatDate(v.createdAt)} · effective {formatDate(v.effectiveFrom)}
                </div>
              </div>
              <div className="font-mono text-[11px] text-foreground-muted">
                {HEALTH_BANDS.thriving.label} ≥{v.thresholds.thriving} · {HEALTH_BANDS.stable.label} ≥{v.thresholds.stable} · {HEALTH_BANDS.atRisk.label} ≥{v.thresholds.atRisk}
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
