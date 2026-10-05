import { Skeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading agent…</span>
      <Skeleton className="mb-5 h-8 w-80" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-28" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 max-w-[520px]" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
