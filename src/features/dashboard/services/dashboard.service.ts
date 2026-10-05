import { HEALTH_BAND_ORDER, LIFECYCLE_STAGES, type HealthBandKey } from "@/config/health";
import { RENEWAL_WIN_PROBABILITY } from "@/config/outcomes";
import { toListItem, type AccountListItem } from "@/features/accounts/services/account.service";
import { listAccountRows } from "@/features/accounts/repositories/account.repository";
import { getExpansionCandidates } from "@/features/outcomes/domain/risk";
import { toAccountFacts } from "@/features/accounts/domain/facts";
import { isAtRiskBand } from "@/features/health/domain/score";
import { db } from "@/lib/db/client";
import { assertPermission, type ServiceContext } from "@/lib/server/context";

export interface DashboardOverview {
  kpis: {
    totalAccounts: number;
    totalArr: number;
    averageScore: number;
    averageScoreDelta: number;
    healthy: number;
    atRisk: number;
    critical: number;
    atRiskArr: number;
    renewals90: number;
    renewals90Arr: number;
    expansionPotential: number;
    expansionAccounts: number;
  };
  distribution: Array<{ band: HealthBandKey; count: number; arr: number }>;
  byLifecycle: Array<{ lifecycle: string; count: number; averageScore: number; bands: Record<HealthBandKey, number> }>;
}

export async function getDashboardOverview(ctx: ServiceContext): Promise<DashboardOverview> {
  assertPermission(ctx, "accounts.read");
  const rows = await listAccountRows(db, ctx, { activeOnly: true });
  const now = new Date();
  const facts = rows.map((r) => toAccountFacts(r, now));
  const total = facts.length;
  const avg = total ? facts.reduce((s, f) => s + f.healthScore, 0) / total : 0;
  const avgDelta = total ? rows.reduce((s, r) => s + (r.trendDelta ?? 0), 0) / total : 0;
  const renewals90 = facts.filter((f) => f.renewalInDays !== null && f.renewalInDays >= 0 && f.renewalInDays <= 90);
  const expansion = getExpansionCandidates(facts);
  const expansionIds = new Set(expansion.flatMap((g) => g.accounts.map((a) => a.id)));

  return {
    kpis: {
      totalAccounts: total,
      totalArr: facts.reduce((s, f) => s + f.arr, 0),
      averageScore: Math.round(avg),
      averageScoreDelta: Math.round(avgDelta),
      healthy: facts.filter((f) => f.band === "thriving" || f.band === "stable").length,
      atRisk: facts.filter((f) => f.band === "atRisk").length,
      critical: facts.filter((f) => f.band === "critical").length,
      atRiskArr: facts.filter((f) => isAtRiskBand(f.band)).reduce((s, f) => s + f.arr, 0),
      renewals90: renewals90.length,
      renewals90Arr: renewals90.reduce((s, f) => s + f.arr, 0),
      expansionPotential: expansion.reduce((s, g) => s + g.estimatedPotential, 0),
      expansionAccounts: expansionIds.size,
    },
    distribution: HEALTH_BAND_ORDER.map((band) => {
      const list = facts.filter((f) => f.band === band);
      return { band, count: list.length, arr: list.reduce((s, f) => s + f.arr, 0) };
    }),
    byLifecycle: LIFECYCLE_STAGES.map((lifecycle) => {
      const list = facts.filter((f) => f.lifecycle === lifecycle);
      const bands = Object.fromEntries(HEALTH_BAND_ORDER.map((b) => [b, list.filter((f) => f.band === b).length])) as Record<HealthBandKey, number>;
      return { lifecycle, count: list.length, averageScore: list.length ? Math.round(list.reduce((s, f) => s + f.healthScore, 0) / list.length) : 0, bands };
    }),
  };
}

export interface RenewalForecast {
  arr90: number;
  arr180: number;
  weighted180: number;
  atRisk180: number;
  expansionPipeline: number;
  expansionCount: number;
  monthly: Array<{ month: string; committed: number; atRisk: number }>;
  pipeline: Array<AccountListItem & { winProbability: number; forecast: "Committed" | "At risk" | "Likely churn" }>;
  expansionReady: Array<AccountListItem & { estimate: number }>;
}

export async function getRenewalForecast(ctx: ServiceContext): Promise<RenewalForecast> {
  assertPermission(ctx, "accounts.read");
  const rows = await listAccountRows(db, ctx, { activeOnly: true });
  const now = new Date();
  const items = rows.map((r) => toListItem(r, now));
  const within = (d: number) => items.filter((i) => i.renewalInDays !== null && i.renewalInDays >= 0 && i.renewalInDays <= d);
  const upcoming = within(180).sort((a, b) => (a.renewalInDays ?? 0) - (b.renewalInDays ?? 0));
  const growth = getExpansionCandidates(rows.map((r) => toAccountFacts(r, now))).find((g) => g.type.key === "growthReady");
  const growthIds = new Set(growth?.accounts.map((a) => a.id));

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) };
  });

  return {
    arr90: within(90).reduce((s, i) => s + i.arr, 0),
    arr180: upcoming.reduce((s, i) => s + i.arr, 0),
    weighted180: upcoming.reduce((s, i) => s + i.arr * RENEWAL_WIN_PROBABILITY[i.band], 0),
    atRisk180: upcoming.filter((i) => isAtRiskBand(i.band)).reduce((s, i) => s + i.arr, 0),
    expansionPipeline: growth?.estimatedPotential ?? 0,
    expansionCount: growth?.accounts.length ?? 0,
    monthly: months.map((m) => {
      const list = upcoming.filter((i) => i.renewalDate?.startsWith(m.key));
      return {
        month: m.label,
        committed: list.filter((i) => !isAtRiskBand(i.band)).reduce((s, i) => s + i.arr, 0),
        atRisk: list.filter((i) => isAtRiskBand(i.band)).reduce((s, i) => s + i.arr, 0),
      };
    }),
    pipeline: upcoming.map((i) => ({
      ...i,
      winProbability: RENEWAL_WIN_PROBABILITY[i.band],
      forecast: i.band === "thriving" || i.band === "stable" ? "Committed" : i.band === "atRisk" ? "At risk" : "Likely churn",
    })),
    expansionReady: items.filter((i) => growthIds.has(i.id)).map((i) => ({ ...i, estimate: i.arr * (growth?.type.estimatedExpansionRate ?? 0) })),
  };
}
