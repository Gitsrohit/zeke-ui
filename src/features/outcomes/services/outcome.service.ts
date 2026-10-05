import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_WEIGHTS, type LifecycleStageName, type SourceWeights } from "@/config/health";
import { toAccountFacts } from "@/features/accounts/domain/facts";
import { listAccountRows } from "@/features/accounts/repositories/account.repository";
import { listAgents } from "@/features/agents/repositories/agent.repository";
import { recordAudit } from "@/features/audit/services/audit.service";
import { getCurrentSourceScores, listActiveScorecards, scorecardKey } from "@/features/health/repositories/health.repository";
import { getExpansionCandidates, getRiskCandidates, groupRiskCandidates, type OutcomeAccountInput } from "@/features/outcomes/domain/risk";
import { db } from "@/lib/db/client";
import { outcomeDismissals } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";
import { addDays } from "@/lib/utils/dates";

async function loadOutcomeInputs(ctx: ServiceContext): Promise<OutcomeAccountInput[]> {
  const rows = await listAccountRows(db, ctx, { activeOnly: true });
  const [sources, scorecards] = await Promise.all([getCurrentSourceScores(db, ctx.organizationId, rows.map((r) => r.id)), listActiveScorecards(db, ctx.organizationId)]);
  const byKey = new Map(scorecards.map((s) => [scorecardKey(s.lifecycleStageId, s.segmentId), s.weights]));
  const now = new Date();
  return rows.map((r) => ({
    facts: toAccountFacts(r, now),
    sources: sources.get(r.id) ?? {},
    weights: byKey.get(scorecardKey(r.lifecycleStageId, r.segmentId)) ?? (DEFAULT_WEIGHTS[r.lifecycle as LifecycleStageName] as SourceWeights | undefined) ?? DEFAULT_WEIGHTS.Adoption,
  }));
}

async function activeDismissals(ctx: ServiceContext): Promise<Set<string>> {
  const rows = await db
    .select({ accountId: outcomeDismissals.accountId })
    .from(outcomeDismissals)
    .where(and(eq(outcomeDismissals.organizationId, ctx.organizationId), eq(outcomeDismissals.kind, "risk"), gte(outcomeDismissals.dismissedUntil, new Date())));
  return new Set(rows.map((r) => r.accountId));
}

async function agentLookup(ctx: ServiceContext) {
  const agents = await listAgents(db, ctx.organizationId);
  return new Map(agents.filter((a) => a.status === "active").map((a) => [a.key, { id: a.id, name: a.name }]));
}

export async function getRiskOverview(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const [inputs, dismissed, agents] = await Promise.all([loadOutcomeInputs(ctx), activeDismissals(ctx), agentLookup(ctx)]);
  const groups = groupRiskCandidates(getRiskCandidates(inputs, dismissed));
  return {
    groups: groups.map((g) => ({
      source: g.source,
      label: g.type.label,
      description: g.type.description,
      recommendedAction: g.type.recommendedAction,
      agent: agents.get(g.type.recommendedAgentKey) ?? null,
      totalArr: g.totalArr,
      accounts: g.candidates.map((c) => ({
        ...c.facts,
        observedSignal: c.rootCause.observedSignal,
        inference: c.rootCause.inference,
        risingRisk: c.rootCause.risingRisk,
        recommendedAgent: agents.get(c.rootCause.recommendedAgentKey) ?? null,
      })),
    })),
    dismissedCount: dismissed.size,
  };
}

export async function getRiskCount(ctx: ServiceContext): Promise<number> {
  const [inputs, dismissed] = await Promise.all([loadOutcomeInputs(ctx), activeDismissals(ctx)]);
  return getRiskCandidates(inputs, dismissed).length;
}

export async function getExpansionOverview(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const [inputs, agents] = await Promise.all([loadOutcomeInputs(ctx), agentLookup(ctx)]);
  const groups = getExpansionCandidates(inputs.map((i) => i.facts));
  return {
    groups: groups.map((g) => ({
      key: g.type.key,
      label: g.type.label,
      description: g.type.description,
      observedSignal: g.observedSignal,
      rate: g.type.estimatedExpansionRate,
      agent: agents.get(g.type.recommendedAgentKey) ?? null,
      totalArr: g.totalArr,
      estimatedPotential: g.estimatedPotential,
      accounts: g.accounts,
    })),
    uniqueAccounts: new Set(groups.flatMap((g) => g.accounts.map((a) => a.id))).size,
    totalPotential: groups.reduce((s, g) => s + g.estimatedPotential, 0),
  };
}

export const dismissSchema = z.object({
  accountId: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(90).default(30),
  reason: z.string().trim().max(300).optional(),
});

export async function dismissRisk(ctx: ServiceContext, input: unknown) {
  assertPermission(ctx, "accounts.write");
  const { accountId, days, reason } = parseInput(dismissSchema, input);
  const [account] = await listAccountRows(db, ctx, { ids: [accountId] });
  if (!account) throw new NotFoundError("Account");
  await db.transaction(async (tx) => {
    await tx.insert(outcomeDismissals).values({ organizationId: ctx.organizationId, accountId, kind: "risk", reason: reason ?? null, dismissedById: ctx.userId, dismissedUntil: addDays(new Date(), days) });
    await recordAudit(tx, ctx, { action: "outcome.dismissed", entityType: "account", entityId: accountId, summary: `Dismissed ${account.name} from risk recommendations for ${days} days${reason ? ` — ${reason}` : ""}` });
  });
}
