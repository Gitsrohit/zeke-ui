"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { HEALTH_BAND_ORDER, HEALTH_BANDS, HEALTH_SOURCES, LIFECYCLE_STAGES, SEGMENTS } from "@/config/health";
import { Card } from "@/components/shared/card";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

type Option = [value: string, label: string];

interface FilterDef {
  key: string;
  label: string;
  all: string;
  options: Option[];
}

const SUB_OPS: Option[] = [
  ["lt40", "below 40"],
  ["lt60", "below 60"],
  ["gte80", "80 or above"],
];

export function ScoreFilterBar({ owners, matching, total }: { owners: Array<{ id: string; name: string }>; matching: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounced = useDebouncedValue(q, 300);

  const defs: FilterDef[] = [
    { key: "stage", label: "Stage", all: "All stages", options: LIFECYCLE_STAGES.map((v) => [v, v]) },
    { key: "segment", label: "Segment", all: "All segments", options: SEGMENTS.map((v) => [v, v]) },
    { key: "csm", label: "CSM", all: "All CSMs", options: owners.map((o) => [o.id, o.name]) },
    { key: "band", label: "Health", all: "All health bands", options: HEALTH_BAND_ORDER.map((b) => [b, HEALTH_BANDS[b].label]) },
    { key: "trend", label: "Trend", all: "Any trend", options: [["up", "Improving"], ["down", "Declining"], ["flat", "Steady"]] },
    { key: "arr", label: "ARR", all: "Any ARR", options: [["lt50", "Under $50k"], ["50-150", "$50k – $150k"], ["gt150", "Over $150k"]] },
    { key: "renew", label: "Renewal", all: "Any renewal date", options: [["90", "Renewing ≤ 90 days"], ["180", "Renewing ≤ 180 days"]] },
    { key: "weak", label: "Weakest source", all: "Any weakest source", options: HEALTH_SOURCES.map((s) => [s.key, s.name]) },
  ];
  const subSrc: FilterDef = { key: "subSrc", label: "Sub-score source", all: "Any source", options: HEALTH_SOURCES.map((s) => [s.key, s.name]) };
  const subOp: FilterDef = { key: "subOp", label: "Sub-score value", all: "any value", options: SUB_OPS };

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if ((params.get("q") ?? "") !== debounced) update({ q: debounced || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced search value
  }, [debounced]);

  const select = (d: FilterDef) => {
    const value = params.get(d.key) ?? "";
    return (
      <select
        key={d.key}
        aria-label={d.label}
        value={value}
        onChange={(e) => update({ [d.key]: e.target.value || null })}
        className={cn(
          "h-8 max-w-[190px] min-w-0 cursor-pointer rounded-[7px] border bg-surface px-2 text-[12.5px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-violet/20",
          value ? "border-violet bg-violet-tint font-semibold text-primary" : "border-border",
        )}
      >
        <option value="">{d.all}</option>
        {d.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    );
  };

  const chips: Array<{ keys: string[]; text: string }> = [];
  if (params.get("q")) chips.push({ keys: ["q"], text: `Search: “${params.get("q")}”` });
  for (const d of defs) {
    const v = params.get(d.key);
    if (v) chips.push({ keys: [d.key], text: `${d.label}: ${d.options.find((o) => o[0] === v)?.[1] ?? v}` });
  }
  const ss = params.get("subSrc");
  const so = params.get("subOp");
  if (ss && so) chips.push({ keys: ["subSrc", "subOp"], text: `${HEALTH_SOURCES.find((s) => s.key === ss)?.name ?? ss} ${SUB_OPS.find((o) => o[0] === so)?.[1] ?? so}` });

  return (
    <Card className="mb-5 flex flex-col gap-2 p-3" aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 min-w-[220px] flex-[1_1_280px] items-center gap-2 rounded-[7px] border border-border bg-surface px-3 text-foreground-faint focus-within:border-violet">
          <Search className="size-[15px] shrink-0" aria-hidden />
          <span className="sr-only">Search accounts</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, CSM, stage, segment…" className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground-faint" />
        </label>
        {defs.slice(0, 4).map(select)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {defs.slice(4).map(select)}
        <span className="text-label ml-1">Sub-score</span>
        {select(subSrc)}
        {select(subOp)}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
        <span className="mr-1.5 font-mono text-[11.5px] text-foreground-faint" aria-live="polite">
          {matching} of {total} accounts
        </span>
        {chips.map((c) => (
          <button
            key={c.text}
            type="button"
            onClick={() => {
              if (c.keys.includes("q")) setQ("");
              update(Object.fromEntries(c.keys.map((k) => [k, null])));
            }}
            className="inline-flex items-center gap-1 rounded-full border border-violet/30 bg-violet-tint py-[3px] pr-1.5 pl-2.5 text-[11.5px] font-semibold text-primary hover:bg-violet-tint/70"
            aria-label={`Remove filter ${c.text}`}
          >
            {c.text}
            <X className="size-3" aria-hidden />
          </button>
        ))}
        {chips.length ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setQ("");
              update(Object.fromEntries(["q", ...defs.map((d) => d.key), "subSrc", "subOp"].map((k) => [k, null])));
            }}
          >
            Clear all
          </Button>
        ) : (
          <span className="text-[11.5px] text-foreground-faint">No filters applied — showing every account</span>
        )}
      </div>
    </Card>
  );
}
