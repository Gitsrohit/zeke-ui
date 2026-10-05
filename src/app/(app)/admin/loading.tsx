import { TableSkeleton } from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
