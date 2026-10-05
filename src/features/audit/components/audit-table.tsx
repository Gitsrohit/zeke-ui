"use client";

import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { Fragment, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";

export interface AuditRow {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <div className="text-label mb-1">{label}</div>
      {value === null || value === undefined ? (
        <p className="text-[12px] text-foreground-faint">Not recorded</p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-surface p-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-foreground">{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  );
}

export function AuditTable({ rows, filtered }: { rows: AuditRow[]; filtered: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title={filtered ? "No events match these filters" : "Nothing logged yet"}
        description={filtered ? "Try a wider time window or clear the search." : "Weighting changes, agent launches, approvals and integration changes will appear here as they happen."}
      />
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">Audit log events</caption>
        <thead>
          <tr>
            <th scope="col" className="w-8 border-b border-border px-2 pt-3 pb-2.5">
              <span className="sr-only">Details</span>
            </th>
            {["When", "Actor", "Action", "Entity", "Summary", "IP"].map((h) => (
              <th key={h} scope="col" className="text-label border-b border-border px-3 pt-3 pb-2.5 text-left whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expanded = open.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr className="align-top">
                  <td className="border-b border-border px-2 py-2.5">
                    <Button variant="ghost" size="icon-xs" aria-expanded={expanded} aria-controls={`audit-${r.id}`} aria-label={expanded ? "Hide details" : "Show details"} onClick={() => toggle(r.id)}>
                      {expanded ? <ChevronDown /> : <ChevronRight />}
                    </Button>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <time dateTime={r.createdAt} className="font-mono text-xs text-foreground-faint" tabIndex={0}>
                          {formatRelativeTime(r.createdAt)}
                        </time>
                      </TooltipTrigger>
                      <TooltipContent>{formatDateTime(r.createdAt)}</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">{r.actorName}</td>
                  <td className="border-b border-border px-3 py-2.5">
                    <span className="rounded-full bg-primary-tint px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-primary">{r.action}</span>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">
                    <span className="text-foreground-muted">{r.entityType.replace(/_/g, " ")}</span>
                    {r.entityId && <span className="ml-1 font-mono text-[11px] text-foreground-faint" title={r.entityId}>#{r.entityId.slice(0, 8)}</span>}
                  </td>
                  <td className="min-w-[260px] border-b border-border px-3 py-2.5 text-foreground-muted">{r.summary}</td>
                  <td className="border-b border-border px-3 py-2.5 font-mono text-[11.5px] whitespace-nowrap text-foreground-faint">{r.ipAddress ?? "—"}</td>
                </tr>
                {expanded && (
                  <tr id={`audit-${r.id}`}>
                    <td colSpan={7} className="border-b border-border bg-surface-muted px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Json label="Before" value={r.before} />
                        <Json label="After" value={r.after} />
                      </div>
                      <p className="mt-2 text-[11.5px] text-foreground-faint">
                        Device: <span className="font-mono">{r.userAgent ?? "unknown"}</span> · {formatDateTime(r.createdAt)}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
