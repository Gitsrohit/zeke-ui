"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { HealthBadge, ScoreBadge } from "@/components/shared/health-badge";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { DataTable } from "@/components/tables/data-table";
import type { AccountListItem } from "@/features/accounts/services/account.service";
import { formatCurrency } from "@/lib/utils/format";

const columns: ColumnDef<AccountListItem, unknown>[] = [
  {
    id: "name",
    header: "Account",
    accessorKey: "name",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <AccountAvatar name={row.original.name} />
        <div className="min-w-0">
          <div className="font-semibold whitespace-nowrap">{row.original.name}</div>
          <div className="text-[11.5px] text-foreground-faint">{row.original.ownerName ?? "Unassigned"}</div>
        </div>
      </div>
    ),
  },
  { id: "score", header: "Health", accessorKey: "score", cell: ({ row }) => <ScoreBadge score={row.original.score} band={row.original.band} /> },
  { id: "band", header: "Band", accessorKey: "band", cell: ({ row }) => <HealthBadge band={row.original.band} /> },
  { id: "trend", header: "Trend", accessorKey: "trendDelta", cell: ({ row }) => <TrendIndicator delta={row.original.trendDelta} /> },
  { id: "arr", header: "ARR", accessorKey: "arr", meta: { align: "right" }, cell: ({ row }) => <span className="font-mono">{formatCurrency(row.original.arr)}</span> },
];

export function ScorecardAccountsTable({ accounts }: { accounts: AccountListItem[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={accounts}
      getRowId={(r) => r.id}
      caption="Accounts scored by this scorecard"
      onRowClick={(r) => router.push(`/accounts/${r.id}`)}
      pageSize={10}
      enableColumnVisibility={false}
      empty={<EmptyState icon={Building2} title="No accounts on this scorecard" description="Accounts appear here when they're in this lifecycle stage and segment." compact />}
    />
  );
}
