"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Target } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/shared/skeletons";
import type { AudienceFilter } from "@/features/audiences/domain/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { postJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { AccountMatchTable } from "./account-match-table";
import type { MatchedAccount } from "./types";

export interface PreviewResult {
  total: number;
  count: number;
  accounts: MatchedAccount[];
}

/** Live, debounced evaluation of the current filter against the accounts the user can see. */
export function useAudiencePreview(filter: AudienceFilter, valid: boolean) {
  const key = JSON.stringify(filter);
  const debounced = useDebouncedValue(key, 300);
  return useQuery({
    queryKey: ["audience-preview", debounced],
    queryFn: () => postJson<PreviewResult>(API.audiencePreview, JSON.parse(debounced) as AudienceFilter),
    enabled: valid,
    placeholderData: (prev) => prev,
  });
}

export function AudiencePreview({ query, valid }: { query: ReturnType<typeof useAudiencePreview>; valid: boolean }) {
  if (!valid) {
    return <p className="px-4 py-8 text-center text-[12.5px] text-foreground-faint">Fix the highlighted conditions to see matching accounts.</p>;
  }
  if (query.isError) return <ErrorState description={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />;
  if (!query.data) {
    return (
      <div className="space-y-3 p-4" role="status" aria-busy="true">
        <span className="sr-only">Evaluating audience…</span>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
    );
  }
  if (query.data.count === 0) return <EmptyState icon={Target} title="No matches" description="No matches — loosen a condition, or remove a group." />;
  return (
    <div className={query.isFetching ? "opacity-60 transition-opacity" : undefined}>
      <AccountMatchTable accounts={query.data.accounts} limit={15} caption="Accounts matching the current filter" />
    </div>
  );
}

export function MatchCount({ query, valid }: { query: ReturnType<typeof useAudiencePreview>; valid: boolean }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[13px]" aria-live="polite">
      {valid && query.data ? (
        <>
          Matches <b className="text-base">{query.data.count}</b> of {query.data.total} accounts
        </>
      ) : (
        <span className="text-foreground-faint">{valid ? "Evaluating…" : "Incomplete filter"}</span>
      )}
      {query.isFetching && <Loader2 className="size-3.5 animate-spin text-foreground-faint" aria-hidden />}
    </p>
  );
}
