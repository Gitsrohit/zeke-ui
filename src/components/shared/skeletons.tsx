import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface px-[18px] py-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
      <div className="flex gap-4 border-b border-border pb-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
          <Skeleton className="size-[30px] shrink-0" />
          {Array.from({ length: columns - 1 }, (_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ kpis = true, label = "Loading" }: { kpis?: boolean; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      <div className="mb-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      {kpis && <KpiSkeleton />}
      <TableSkeleton />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
