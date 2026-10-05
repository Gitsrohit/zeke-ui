"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const ALL = "__all";
const WINDOWS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export function AuditFilters({ entityTypes }: { entityTypes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounced = useDebouncedValue(q.trim(), 300);
  const [, startTransition] = useTransition();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if ((params.get("q") ?? "") !== debounced) update("q", debounced || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the debounced search only
  }, [debounced]);

  const hasFilters = Boolean(params.get("q") || params.get("entityType") || params.get("days"));

  return (
    <div className="flex flex-wrap items-center gap-2" role="search">
      <div className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 sm:max-w-[320px]">
        <Search className="size-[15px] shrink-0 text-foreground-faint" aria-hidden />
        <label htmlFor="audit-q" className="sr-only">
          Search audit log
        </label>
        <input id="audit-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action or summary…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-foreground-faint" />
      </div>
      <Select value={params.get("entityType") ?? ALL} onValueChange={(v) => update("entityType", v === ALL ? null : v)}>
        <SelectTrigger aria-label="Entity type" className="min-w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All entities</SelectItem>
          {entityTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {t.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("days") ?? ALL} onValueChange={(v) => update("days", v === ALL ? null : v)}>
        <SelectTrigger aria-label="Time window" className="min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All time</SelectItem>
          {WINDOWS.map((w) => (
            <SelectItem key={w.value} value={w.value}>
              {w.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
