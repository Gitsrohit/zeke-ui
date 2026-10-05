import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { Button } from "@/components/ui/button";
import { AudienceBuilder } from "@/features/audiences/components/audience-builder";
import { loadBuilderContext } from "@/features/audiences/components/load-builder-context";
import { createEmptyFilter, nodeId } from "@/features/audiences/domain/builders";
import type { AudienceFilter, AudienceGroup } from "@/features/audiences/domain/types";
import { audienceFilterSchema } from "@/features/audiences/schemas";
import { getServiceContext } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";

export const metadata: Metadata = { title: "New audience" };

/** Decodes a base64url JSON filter from the URL; returns null for anything invalid. */
function decodeFilter(raw: string | undefined): AudienceFilter | null {
  if (!raw || raw.length > 20_000) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const parsed = audienceFilterSchema.safeParse(json);
    if (!parsed.success) return null;
    // Re-id every node so ids are unique within the builder.
    const reId = (g: AudienceGroup): AudienceGroup => ({ ...g, id: nodeId("g"), conditions: g.conditions.map((c) => ({ ...c, id: nodeId("c") })), groups: g.groups.map(reId) });
    return { combinator: parsed.data.combinator, groups: parsed.data.groups.map(reId) };
  } catch {
    return null;
  }
}

export default async function NewAudiencePage({ searchParams }: PageProps<"/audiences/new">) {
  const ctx = await getServiceContext();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  let context;
  try {
    context = await loadBuilderContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return <PermissionDenied permission="accounts.read" />;
    throw error;
  }
  const prompt = one(params.prompt)?.slice(0, 500);
  const filter = decodeFilter(one(params.filter)) ?? createEmptyFilter();

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/audiences">
          <ArrowLeft /> Library
        </Link>
      </Button>
      <PageHeader title="New audience" description={`Filter ${context.totalAccounts} accounts with AND/OR logic, or describe who you want and let Zeke draft the filters for you to review.`} />
      <AudienceBuilder {...context} initialFilter={filter} initialPrompt={prompt} initialTab={prompt ? "chat" : "manual"} />
    </>
  );
}
