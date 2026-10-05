"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkQuery } from "@/features/work/services/work.service";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
}

interface WorkFiltersProps {
  query: WorkQuery;
  owners: Option[];
  accounts: Option[];
  agents: Option[];
  views: Array<{ key: WorkQuery["view"]; href: string; active: boolean }>;
  chips: Array<{ key: string; label: string; href: string; active: boolean }>;
}

const ALL = "__all";
const VIEW_LABELS: Record<WorkQuery["view"], string> = { open: "Open", snoozed: "Snoozed", completed: "Completed" };

export function WorkFilters({ query, owners, accounts, agents, views, chips }: WorkFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const s = params.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const ownerValue = query.owner !== "me" && query.owner !== "all" ? query.owner : ALL;

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-[7px] border border-border bg-surface" role="group" aria-label="Status">
          {views.map((v) => (
            <Link
              key={v.key}
              href={v.href}
              scroll={false}
              aria-current={v.active ? "page" : undefined}
              className={cn("border-r border-border px-3 py-1.5 text-xs font-medium last:border-r-0", v.active ? "bg-primary text-white" : "text-foreground-muted hover:bg-surface-muted")}
            >
              {VIEW_LABELS[v.key]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick filters">
          {chips.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              scroll={false}
              aria-current={c.active ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                c.active ? "border-violet bg-violet-tint font-semibold text-violet-deep" : "border-border bg-surface text-foreground-muted hover:border-border-strong",
              )}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Owner" value={ownerValue} onChange={(v) => setParam("owner", v === ALL ? (query.owner === "me" ? null : "all") : v)} allLabel="Any owner" options={owners} />
        <FilterSelect label="Account" value={query.accountId ?? ALL} onChange={(v) => setParam("accountId", v === ALL ? null : v)} allLabel="All accounts" options={accounts} />
        <FilterSelect label="Agent" value={query.agentId ?? ALL} onChange={(v) => setParam("agentId", v === ALL ? null : v)} allLabel="All agents" options={agents} />
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, allLabel, options }: { label: string; value: string; onChange: (v: string) => void; allLabel: string; options: Option[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={`Filter by ${label.toLowerCase()}`} className={cn("max-w-[220px] min-w-[150px]", value !== ALL && "border-violet bg-violet-tint font-semibold text-primary")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
