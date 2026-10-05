import { CardGridSkeleton, Skeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
