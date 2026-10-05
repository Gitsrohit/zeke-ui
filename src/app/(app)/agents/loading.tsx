import { CardGridSkeleton, Skeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading agents…</span>
      <Skeleton className="mb-2 h-6 w-72" />
      <Skeleton className="mb-6 h-4 w-96 max-w-full" />
      <CardGridSkeleton />
    </div>
  );
}
