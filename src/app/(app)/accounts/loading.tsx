import { Skeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading accounts…</span>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 mb-6 h-4 w-96 max-w-full" />
      <TableSkeleton rows={10} columns={8} />
    </div>
  );
}
