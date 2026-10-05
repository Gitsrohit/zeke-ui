"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Download, Eye, Layers, MoreHorizontal, Play, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HEALTH_BAND_ORDER, HEALTH_BANDS } from "@/config/health";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { HealthBadge, ScoreBadge } from "@/components/shared/health-badge";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LaunchAgentDialog, type LaunchableAgent } from "@/features/agents/components/launch-agent-dialog";
import type { AccountListItem } from "@/features/accounts/services/account.service";
import { getPredictiveRiskLevel } from "@/features/health/domain/score";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils/format";

export interface AccountFilterOptions {
  lifecycles: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  owners: Array<{ id: string; name: string }>;
}

interface AccountsPage {
  items: AccountListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const PARAM_KEYS = ["q", "lifecycle", "segment", "band", "owner", "sort", "dir", "page"] as const;
const ALL = "__all";

const RISK_STYLES = { high: "text-critical", elevated: "text-at-risk", low: "text-thriving" } as const;
const RISK_LABELS = { high: "High", elevated: "Elevated", low: "Low" } as const;

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger size="sm" aria-label={label} className={cn("min-w-[120px]", value && "border-violet bg-violet-tint font-semibold text-primary")}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AccountsTable({ options, agents, canLaunch, caption = "Accounts" }: { options: AccountFilterOptions; agents: LaunchableAgent[]; canLaunch: boolean; caption?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const get = (k: (typeof PARAM_KEYS)[number]) => searchParams.get(k) ?? "";

  const [search, setSearch] = useState(get("q"));
  const debounced = useDebouncedValue(search.trim(), 300);
  const [launchIds, setLaunchIds] = useState<string[] | null>(null);

  const setParams = (updates: Partial<Record<(typeof PARAM_KEYS)[number], string>>, resetPage = true) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage && !("page" in updates)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (debounced !== (searchParams.get("q") ?? "")) setParams({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when the debounced value changes
  }, [debounced]);

  const apiParams = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of PARAM_KEYS) {
      const v = searchParams.get(k);
      if (v) p.set(k, v);
    }
    if (!p.has("sort")) p.set("sort", "score");
    if (!p.has("dir")) p.set("dir", "asc");
    p.set("pageSize", "25");
    return p;
  }, [searchParams]);

  const query = useQuery({
    queryKey: ["accounts", apiParams.toString()],
    queryFn: () => fetchJson<AccountsPage>(API.accounts(apiParams)),
    placeholderData: keepPreviousData,
  });

  const sorting: SortingState = [{ id: apiParams.get("sort") ?? "score", desc: apiParams.get("dir") === "desc" }];
  const hasFilters = ["q", "lifecycle", "segment", "band", "owner"].some((k) => searchParams.get(k));
  const exportParams = new URLSearchParams(apiParams);
  exportParams.delete("page");
  exportParams.delete("pageSize");

  const columns = useMemo<ColumnDef<AccountListItem, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Account",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-[200px] items-center gap-2.5">
            <AccountAvatar name={row.original.name} />
            <div className="min-w-0">
              <Link href={`/accounts/${row.original.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold hover:text-primary hover:underline">
                {row.original.name}
              </Link>
              <span className="block truncate text-[11.5px] text-foreground-faint">{row.original.domain ?? row.original.segment}</span>
            </div>
          </div>
        ),
      },
      { id: "owner", header: "Owner", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.ownerName ?? "Unassigned"}</span> },
      { id: "lifecycle", header: "Lifecycle", cell: ({ row }) => row.original.lifecycle },
      { id: "segment", header: "Segment", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.segment}</span> },
      { id: "arr", header: "ARR", meta: { align: "right" }, cell: ({ row }) => <span className="font-mono tabular">{formatCurrency(row.original.arr)}</span> },
      {
        id: "score",
        header: "Health",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <ScoreBadge score={row.original.score} band={row.original.band} />
            <HealthBadge band={row.original.band} />
          </span>
        ),
      },
      { id: "trend", header: "Trend", cell: ({ row }) => <TrendIndicator delta={row.original.trendDelta} /> },
      {
        id: "risk",
        header: "Predictive risk",
        cell: ({ row }) => {
          const level = getPredictiveRiskLevel(row.original.predictiveRisk);
          return (
            <span className={cn("font-mono text-xs whitespace-nowrap tabular", RISK_STYLES[level])}>
              {row.original.predictiveRisk} · {RISK_LABELS[level]}
            </span>
          );
        },
      },
      {
        id: "renewal",
        header: "Renewal",
        cell: ({ row }) =>
          row.original.renewalDate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("font-mono text-xs tabular", (row.original.renewalInDays ?? 999) <= 90 && "font-semibold text-at-risk")}>{row.original.renewalInDays}d</span>
              </TooltipTrigger>
              <TooltipContent>{formatDate(row.original.renewalDate)}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-foreground-faint">—</span>
          ),
      },
      {
        id: "activity",
        header: "Last activity",
        cell: ({ row }) => <span className="text-xs whitespace-nowrap text-foreground-muted">{row.original.lastActivityAt ? formatRelativeTime(row.original.lastActivityAt) : "—"}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`} onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem asChild>
                <Link href={`/accounts/${row.original.id}`}>
                  <Eye /> Open account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/score-dashboard?account=${row.original.id}`}>
                  <Layers /> Explain score
                </Link>
              </DropdownMenuItem>
              {canLaunch && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setLaunchIds([row.original.id])}>
                    <Play /> Launch agent
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canLaunch],
  );

  const toolbar = (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[240px]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-foreground-faint" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts, owners, domains…" aria-label="Search accounts" className="h-7 pl-8 text-xs" />
      </div>
      <FilterSelect label="Lifecycle" value={get("lifecycle")} onChange={(v) => setParams({ lifecycle: v })} options={options.lifecycles.map((l) => ({ value: l.name, label: l.name }))} />
      <FilterSelect label="Segment" value={get("segment")} onChange={(v) => setParams({ segment: v })} options={options.segments.map((s) => ({ value: s.name, label: s.name }))} />
      <FilterSelect label="Health" value={get("band")} onChange={(v) => setParams({ band: v })} options={HEALTH_BAND_ORDER.map((b) => ({ value: b, label: HEALTH_BANDS[b].label }))} />
      <FilterSelect label="Owner" value={get("owner")} onChange={(v) => setParams({ owner: v })} options={options.owners.map((o) => ({ value: o.id, label: o.name }))} />
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            setParams({ q: "", lifecycle: "", segment: "", band: "", owner: "" });
          }}
        >
          <X /> Clear
        </Button>
      )}
      <Button asChild variant="outline" size="sm">
        <a href={API.accountsExport(exportParams)} download>
          <Download /> Export
        </a>
      </Button>
    </div>
  );

  if (query.isError && !query.data) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <ErrorState description={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  return (
    <>
      <DataTable
        caption={caption}
        columns={columns}
        data={query.data?.items ?? []}
        getRowId={(r) => r.id}
        loading={query.isFetching}
        manual={{ total: query.data?.total ?? 0, page: Number(apiParams.get("page") ?? 1), pageSize: 25, onPageChange: (p) => setParams({ page: String(p) }, false) }}
        sorting={sorting}
        onSortingChange={(updater) => {
          const next = typeof updater === "function" ? updater(sorting) : updater;
          const s = next[0];
          setParams({ sort: s?.id ?? "", dir: s ? (s.desc ? "desc" : "asc") : "" });
        }}
        enableSelection
        bulkActions={(selected, clear) => (
          <>
            {canLaunch && (
              <Button size="xs" variant="accent" onClick={() => setLaunchIds(selected.map((s) => s.id))}>
                <Play /> Launch agent
              </Button>
            )}
            <Button asChild size="xs" variant="outline">
              <a
                href={API.accountsExport(new URLSearchParams(selected.map((s) => ["id", s.id])))}
                download
                onClick={() => setTimeout(clear, 0)}
              >
                <Download /> Export selected
              </a>
            </Button>
          </>
        )}
        toolbar={toolbar}
        onRowClick={(r) => router.push(`/accounts/${r.id}`)}
        initialColumnVisibility={{ activity: true }}
        empty={
          <EmptyState
            icon={SearchX}
            title={hasFilters ? "No accounts match these filters" : "No accounts yet"}
            description={hasFilters ? "Try removing a filter or a search term." : "Create an account or connect your CRM to start tracking health."}
            action={
              hasFilters ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setParams({ q: "", lifecycle: "", segment: "", band: "", owner: "" });
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
      {launchIds && (
        <LaunchAgentDialog
          open
          onOpenChange={(o) => !o && setLaunchIds(null)}
          accountIds={launchIds}
          agents={agents}
          sourceLabel="Accounts table"
          description={launchIds.length === 1 ? "from the accounts table" : "selected in the accounts table"}
        />
      )}
    </>
  );
}
