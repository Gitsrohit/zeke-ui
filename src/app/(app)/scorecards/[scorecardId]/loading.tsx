import { Skeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading scorecard…</span>
      <Skeleton className="h-6 w-56" />
      <Skeleton className="mt-2 mb-6 h-4 w-96 max-w-full" />
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-[420px] w-full rounded-lg" />
        <Skeleton className="h-[420px] w-full rounded-lg" />
      </div>
      <TableSkeleton rows={4} columns={5} />
    </div>
  );
}
