import { Skeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading work queue…</span>
      <Skeleton className="h-6 w-72" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-8 w-64" />
      <div className="mt-5 flex flex-col gap-2.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5 rounded-lg border border-border bg-surface px-4 py-3.5">
            <Skeleton className="size-8 shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="mt-2 h-3 w-80 max-w-full" />
            </div>
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
