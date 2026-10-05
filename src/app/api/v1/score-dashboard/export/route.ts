import { exportScoreCsv, parseScoreFilters } from "@/features/health/services/score-dashboard.service";
import { requireApiContext } from "@/lib/auth/session";
import { withApi } from "@/lib/server/route";

export const GET = withApi(async (request) => {
  const ctx = await requireApiContext();
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const csv = await exportScoreCsv(ctx, parseScoreFilters(params));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="advanced-score-dashboard-${new Date().toISOString().slice(0, 10)}.csv"` } });
});
