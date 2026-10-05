import { Skeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading account…</span>
      <div className="mb-5 rounded-lg border border-border bg-surface p-5">
        <div className="flex gap-3">
          <Skeleton className="size-10" />
          <div className="flex-1">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-4 border-t border-border pt-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
      <Skeleton className="mb-5 h-8 w-full" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
