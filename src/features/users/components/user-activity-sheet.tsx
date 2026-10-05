"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useState } from "react";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { Pill } from "@/components/shared/pill";
import { Skeleton } from "@/components/shared/skeletons";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";

interface ActivityResponse {
  member: { name: string; role: string; status: string; title: string | null; segments: string[] };
  window: number;
  total: number;
  activeDays: number;
  byType: Array<{ type: string; label: string; count: number }>;
  recent: Array<{ id: string; label: string; occurredAt: string }>;
}

const WINDOWS = [30, 90, 180] as const;

export function UserActivitySheet({ member, onOpenChange }: { member: { membershipId: string; name: string; roleName: string; status: string } | null; onOpenChange: (open: boolean) => void }) {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const query = useQuery({
    queryKey: ["user-activity", member?.membershipId, days],
    queryFn: () => fetchJson<ActivityResponse>(API.userActivity(member!.membershipId, days)),
    enabled: Boolean(member),
  });
  const data = query.data;
  const max = Math.max(1, ...(data?.byType.map((t) => t.count) ?? [1]));

  return (
    <Sheet open={Boolean(member)} onOpenChange={onOpenChange}>
      <SheetContent>
        {member && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <AccountAvatar name={member.name} size="lg" />
                <div className="min-w-0">
                  <SheetTitle>{member.name}</SheetTitle>
                  <SheetDescription asChild>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Pill tone="neutral">{member.roleName}</Pill>
                      <Pill tone={member.status === "active" ? "thriving" : member.status === "invited" ? "violet" : "muted"} dot>
                        {member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : "Deactivated"}
                      </Pill>
                    </div>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <SheetBody>
              {data && (
                <p className="mb-3 text-xs text-foreground-faint">
                  Account access: {data.member.segments.length ? data.member.segments.join(", ") : "All segments"}
                </p>
              )}
              <div role="tablist" aria-label="Activity window" className="mb-5 flex gap-5 border-b border-border">
                {WINDOWS.map((w) => (
                  <button
                    key={w}
                    role="tab"
                    type="button"
                    aria-selected={days === w}
                    onClick={() => setDays(w)}
                    className={cn("-mb-px border-b-2 px-1 py-2 text-[12.5px] font-semibold", days === w ? "border-violet text-primary" : "border-transparent text-foreground-faint hover:text-foreground-muted")}
                  >
                    Last {w} days
                  </button>
                ))}
              </div>
              {query.isError ? (
                <ErrorState description={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
              ) : !data ? (
                <div className="space-y-3" role="status" aria-busy="true">
                  <span className="sr-only">Loading activity…</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                  <Skeleton className="h-32" />
                </div>
              ) : (
                <>
                  <div className="mb-6 grid grid-cols-3 gap-3">
                    <KpiCard label="Actions" value={data.total} />
                    <KpiCard label="Active days" value={data.activeDays} />
                    <KpiCard label="Most common" value={data.byType[0]?.label ?? "—"} valueClassName="!text-[14px] !leading-snug !whitespace-normal" />
                  </div>
                  {data.total === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No activity in this window"
                      description={member.status === "invited" ? "This teammate hasn't accepted their invite yet." : "Try a wider date range."}
                    />
                  ) : (
                    <>
                      <h3 className="mb-3 text-[13.5px] font-semibold">Activity by type</h3>
                      <ul className="mb-6 flex flex-col gap-2.5">
                        {data.byType.map((t) => (
                          <li key={t.type}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="font-semibold">{t.label}</span>
                              <span className="font-mono text-foreground-muted">{t.count}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded bg-border" aria-hidden>
                              <div className="h-full rounded bg-violet" style={{ width: `${(t.count / max) * 100}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                      <h3 className="mb-3 text-[13.5px] font-semibold">Recent activity</h3>
                      <ol className="flex flex-col">
                        {data.recent.map((e, i) => (
                          <li key={e.id} className="relative flex gap-3 pb-4">
                            {i < data.recent.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[13px] w-px bg-border-strong" />}
                            <span className="z-10 flex size-[27px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                              <Clock className="size-3" aria-hidden />
                            </span>
                            <div>
                              <div className="text-[12.5px] font-semibold">{e.label}</div>
                              <time dateTime={e.occurredAt} title={formatDateTime(e.occurredAt)} className="font-mono text-[11px] text-foreground-faint">
                                {formatRelativeTime(e.occurredAt)}
                              </time>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {data.total > data.recent.length && <p className="text-[11.5px] text-foreground-faint">+ {data.total - data.recent.length} more actions in this window.</p>}
                    </>
                  )}
                </>
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
