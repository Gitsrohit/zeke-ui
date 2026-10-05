import { Skeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading scorecards…</span>
      <Skeleton className="h-6 w-64" />
      <Skeleton className="mt-2 mb-6 h-4 w-[30rem] max-w-full" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-[128px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
