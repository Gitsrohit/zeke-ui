import { z } from "zod";
import { listAccountFacts } from "@/features/accounts/services/account.service";
import { getAIProvider } from "@/features/ai";
import type { AudienceParseResult } from "@/features/ai/types";
import { recordAudit } from "@/features/audit/services/audit.service";
import { countConditions, evaluateAudience } from "@/features/audiences/domain/evaluate";
import type { AccountFacts, AudienceFilter } from "@/features/audiences/domain/types";
import {
  deleteAudience,
  findAudience,
  getStaticMemberIds,
  listAudiences,
  recordEvaluation,
  replaceStaticMembers,
  saveAudienceTree,
  type AudienceRecord,
} from "@/features/audiences/repositories/audience.repository";
import { audienceFilterSchema, saveAudienceSchema } from "@/features/audiences/schemas";
import { listOrgUsers } from "@/features/users/repositories/user.repository";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";

export interface AudienceSummary extends AudienceRecord {
  memberCount: number;
  conditionCount: number;
}

function members(audience: AudienceRecord, facts: AccountFacts[], staticIds: Map<string, string[]>): AccountFacts[] {
  if (audience.type === "static") {
    const ids = new Set(staticIds.get(audience.id) ?? []);
    return facts.filter((f) => ids.has(f.id));
  }
  return evaluateAudience(facts, audience.filter);
}

export async function listAudienceSummaries(ctx: ServiceContext): Promise<AudienceSummary[]> {
  assertPermission(ctx, "accounts.read");
  const [audiences, facts] = await Promise.all([listAudiences(db, ctx.organizationId), listAccountFacts(ctx)]);
  const staticIds = await getStaticMemberIds(db, ctx.organizationId, audiences.filter((a) => a.type === "static").map((a) => a.id));
  return audiences.map((a) => ({ ...a, memberCount: members(a, facts, staticIds).length, conditionCount: countConditions(a.filter) }));
}

export async function getAudience(ctx: ServiceContext, audienceId: string) {
  assertPermission(ctx, "accounts.read");
  if (!z.string().uuid().safeParse(audienceId).success) throw new NotFoundError("Audience");
  const audience = await findAudience(db, ctx.organizationId, audienceId);
  if (!audience) throw new NotFoundError("Audience");
  return audience;
}

/** Resolves an audience's current members: live re-evaluation for dynamic, frozen list for static. */
export async function resolveAudienceMembers(ctx: ServiceContext, audienceId: string): Promise<{ audience: AudienceRecord; members: AccountFacts[] }> {
  const audience = await getAudience(ctx, audienceId);
  const facts = await listAccountFacts(ctx);
  const staticIds = await getStaticMemberIds(db, ctx.organizationId, audience.type === "static" ? [audience.id] : []);
  const result = members(audience, facts, staticIds);
  await recordEvaluation(db, audience.id, result.length);
  return { audience, members: result };
}

export async function previewAudience(ctx: ServiceContext, input: unknown) {
  assertPermission(ctx, "accounts.read");
  const filter = parseInput(audienceFilterSchema, input);
  const facts = await listAccountFacts(ctx);
  const matches = evaluateAudience(facts, filter);
  return { total: facts.length, count: matches.length, accounts: matches.sort((a, b) => a.healthScore - b.healthScore) };
}

export async function saveAudience(ctx: ServiceContext, input: unknown, audienceId?: string): Promise<{ id: string; memberCount: number }> {
  assertPermission(ctx, "audiences.manage");
  const values = parseInput(saveAudienceSchema, input);
  if (audienceId) await getAudience(ctx, audienceId);
  const facts = await listAccountFacts(ctx);
  const matched = evaluateAudience(facts, values.filter);
  return db.transaction(async (tx) => {
    const id = await saveAudienceTree(tx, { organizationId: ctx.organizationId, createdById: ctx.userId, audienceId, name: values.name, description: values.description, type: values.type, filter: values.filter });
    // Static snapshots freeze today's members; dynamic audiences keep no membership rows.
    await replaceStaticMembers(tx, ctx.organizationId, id, values.type === "static" ? matched.map((m) => m.id) : []);
    await recordEvaluation(tx, id, matched.length);
    await recordAudit(tx, ctx, {
      action: audienceId ? "audience.updated" : "audience.created",
      entityType: "audience",
      entityId: id,
      summary: `${values.name} — ${matched.length} accounts (${values.type === "static" ? "static snapshot" : "live"})`,
      after: { type: values.type, filter: values.filter },
    });
    return { id, memberCount: matched.length };
  });
}

export async function removeAudience(ctx: ServiceContext, audienceId: string): Promise<void> {
  assertPermission(ctx, "audiences.manage");
  const audience = await getAudience(ctx, audienceId);
  await db.transaction(async (tx) => {
    await deleteAudience(tx, ctx.organizationId, audienceId);
    await recordAudit(tx, ctx, { action: "audience.deleted", entityType: "audience", entityId: audienceId, summary: `Deleted audience ${audience.name}`, before: { filter: audience.filter, type: audience.type } });
  });
}

/** AI-assisted parsing. Returns a proposal only — the user reviews and edits before anything is saved or launched. */
export async function parseAudienceWithAI(ctx: ServiceContext, prompt: string): Promise<AudienceParseResult & { preview: { count: number; total: number; accounts: AccountFacts[] } }> {
  assertPermission(ctx, "accounts.read");
  rateLimit(`ai:${ctx.userId}`, 30, 60_000);
  const text = z.string().trim().min(3, "Describe the audience you want").max(500).parse(prompt);
  const owners = await listOrgUsers(db, ctx.organizationId);
  const result = await getAIProvider().parseAudience(text, { owners });
  const facts = await listAccountFacts(ctx);
  const matches = evaluateAudience(facts, result.filter as AudienceFilter);
  return { ...result, preview: { count: matches.length, total: facts.length, accounts: matches } };
}
