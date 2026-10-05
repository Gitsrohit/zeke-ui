import { Skeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading builder…</span>
      <Skeleton className="mb-6 h-6 w-56" />
      <Skeleton className="mb-4 h-8 w-64" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
