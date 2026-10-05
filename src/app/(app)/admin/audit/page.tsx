import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/shared/card";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import { AuditFilters } from "@/features/audit/components/audit-filters";
import { AuditTable } from "@/features/audit/components/audit-table";
import { getAuditLog } from "@/features/audit/services/audit-query.service";
import { getServiceContext } from "@/lib/auth/session";
import { can } from "@/lib/server/context";

export const metadata = { title: "Audit log" };

function pageHref(params: Record<string, string | undefined>, page: number) {
  const next = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  next.set("page", String(page));
  return `/admin/audit?${next.toString()}`;
}

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const ctx = await getServiceContext();
  if (!can(ctx, "audit.read")) return <PermissionDenied permission="audit.read" />;
  const raw = await searchParams;
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  const input = { q: params.q || undefined, entityType: params.entityType || undefined, days: params.days || undefined, page: params.page || undefined };
  const parsed = await getAuditLog(ctx, input).catch(() => getAuditLog(ctx, {}));
  const { rows, total, page, pageSize, entityTypes } = parsed;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = Boolean(params.q || params.entityType || params.days);

  return (
    <>
      <SectionTitle icon={ScrollText} className="mt-0" hint="Every weighting change, launch, approval and integration change — who did it and when.">
        Audit log
      </SectionTitle>
      <Card>
        <div className="border-b border-border px-3 py-2.5">
          <AuditFilters entityTypes={entityTypes} />
        </div>
        <AuditTable rows={rows} filtered={filtered} />
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-foreground-muted">
            <span className="font-mono">
              {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
            </span>
            <div className="flex items-center gap-1.5">
              {page > 1 ? (
                <Button asChild variant="outline" size="icon-sm">
                  <Link href={pageHref(params, page - 1)} aria-label="Previous page">
                    <ChevronLeft />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="icon-sm" disabled aria-label="Previous page">
                  <ChevronLeft />
                </Button>
              )}
              <span className="px-1 font-mono">
                {page} / {pages}
              </span>
              {page < pages ? (
                <Button asChild variant="outline" size="icon-sm">
                  <Link href={pageHref(params, page + 1)} aria-label="Next page">
                    <ChevronRight />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="icon-sm" disabled aria-label="Next page">
                  <ChevronRight />
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
