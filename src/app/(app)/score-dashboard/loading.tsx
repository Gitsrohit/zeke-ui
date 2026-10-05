import { Card } from "@/components/shared/card";
import { KpiSkeleton, Skeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading score dashboard…</span>
      <Skeleton className="h-6 w-72" />
      <Skeleton className="mt-2 mb-6 h-4 w-[28rem] max-w-full" />
      <Card className="mb-5 p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-3/4" />
      </Card>
      <KpiSkeleton count={5} />
      <div className="mb-6 grid gap-3.5 lg:grid-cols-2">
        <Skeleton className="h-52 w-full rounded-lg" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
      <TableSkeleton rows={6} columns={8} />
    </div>
  );
}
