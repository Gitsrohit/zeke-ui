import { getAccountsPage } from "@/features/accounts/services/account.service";
import { requireApiContext } from "@/lib/auth/session";
import { withApi } from "@/lib/server/route";
import { toCsv } from "@/lib/utils/csv";
import { accountQueryFromParams } from "../query";

export const GET = withApi(async (request) => {
  const ctx = await requireApiContext();
  const params = new URL(request.url).searchParams;
  const ids = new Set(params.getAll("id"));
  const rows: Awaited<ReturnType<typeof getAccountsPage>>["items"] = [];
  for (let page = 1; page <= 200; page++) {
    const result = await getAccountsPage(ctx, { ...accountQueryFromParams(params), page, pageSize: 100 });
    rows.push(...result.items);
    if (page * 100 >= result.total) break;
  }
  const selected = ids.size ? rows.filter((r) => ids.has(r.id)) : rows;
  const csv = toCsv(
    ["Account", "Domain", "Lifecycle", "Segment", "Owner", "ARR", "Health score", "Band", "Trend (90d)", "Predictive risk", "Renewal date", "Last activity"],
    selected.map((r) => [r.name, r.domain, r.lifecycle, r.segment, r.ownerName, r.arr, r.score, r.band, r.trendDelta, r.predictiveRisk, r.renewalDate, r.lastActivityAt?.slice(0, 10)]),
  );
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="accounts-${new Date().toISOString().slice(0, 10)}.csv"` } });
});
