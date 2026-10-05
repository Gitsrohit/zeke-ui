import Link from "next/link";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { ScoreBadge } from "@/components/shared/health-badge";
import { formatCurrency } from "@/lib/utils/format";
import type { MatchedAccount } from "./types";

/** Compact list of matching accounts. Shows the first `limit` rows and a "+N more" footer. */
export function AccountMatchTable({ accounts, limit, caption }: { accounts: MatchedAccount[]; limit?: number; caption: string }) {
  const shown = limit ? accounts.slice(0, limit) : accounts;
  const rest = accounts.length - shown.length;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {["Account", "Lifecycle", "Segment", "Health", "ARR", "Owner"].map((h) => (
              <th key={h} scope="col" className="text-label border-b border-border px-3 pt-3 pb-2.5 text-left whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((a) => (
            <tr key={a.id} className="hover:bg-surface-muted">
              <td className="border-b border-border px-3 py-2.5">
                <Link href={`/accounts/${a.id}`} className="flex items-center gap-2.5 font-semibold hover:text-primary">
                  <AccountAvatar name={a.name} size="sm" />
                  <span className="truncate">{a.name}</span>
                </Link>
              </td>
              <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">{a.lifecycle}</td>
              <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">{a.segment}</td>
              <td className="border-b border-border px-3 py-2.5">
                <ScoreBadge score={a.healthScore} band={a.band} size="sm" />
              </td>
              <td className="border-b border-border px-3 py-2.5 font-mono tabular">{formatCurrency(a.arr)}</td>
              <td className="border-b border-border px-3 py-2.5 whitespace-nowrap">{a.ownerName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rest > 0 && <p className="py-3 text-center text-xs text-foreground-faint">+ {rest} more</p>}
    </div>
  );
}
