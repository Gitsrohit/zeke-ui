import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import { AudienceBuilder } from "@/features/audiences/components/audience-builder";
import { loadBuilderContext } from "@/features/audiences/components/load-builder-context";
import { StaticAudienceView } from "@/features/audiences/components/static-audience-view";
import { resolveAudienceMembers } from "@/features/audiences/services/audience.service";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { formatRelativeTime, pluralize } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Audience" };

export default async function AudiencePage({ params }: PageProps<"/audiences/[audienceId]">) {
  const { audienceId } = await params;
  const ctx = await getServiceContext();
  let data;
  try {
    data = await Promise.all([resolveAudienceMembers(ctx, audienceId), loadBuilderContext(ctx)]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  const [{ audience, members }, context] = data;
  const summary = { id: audience.id, name: audience.name, description: audience.description, type: audience.type };
  const meta = [
    audience.createdByName && `Created by ${audience.createdByName}`,
    `${pluralize(members.length, "account")} ${audience.type === "static" ? "in snapshot" : "match now"}`,
    audience.lastEvaluatedAt && `last evaluated ${formatRelativeTime(audience.lastEvaluatedAt)}`,
  ].filter(Boolean);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/audiences">
          <ArrowLeft /> Library
        </Link>
      </Button>
      <PageHeader
        title={audience.name}
        description={
          <span className="flex flex-col gap-1.5">
            {audience.description && <span>{audience.description}</span>}
            <span className="flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-foreground-faint">
              <Pill tone={audience.type === "static" ? "neutral" : "thriving"} dot>
                {audience.type === "static" ? "Static snapshot" : "Live"}
              </Pill>
              {meta.join(" · ")}
            </span>
          </span>
        }
      />
      {audience.type === "static" ? (
        <StaticAudienceView {...context} audience={summary} filter={audience.filter} members={members} />
      ) : (
        <AudienceBuilder {...context} initialFilter={audience.filter} audience={summary} />
      )}
    </>
  );
}
