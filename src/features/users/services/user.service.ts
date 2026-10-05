import { z } from "zod";
import { inviteSchema, updateMemberSchema } from "@/features/users/schemas";
import { recordAudit } from "@/features/audit/services/audit.service";
import {
  deleteUserSessions,
  findMember,
  findSystemRoleId,
  findUserByEmail,
  insertMembership,
  insertUser,
  listMembers,
  listUserActivity,
  updateMembership,
} from "@/features/users/repositories/user.repository";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db/client";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { canAssignRole, ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { parseInput } from "@/lib/server/action";

export async function getMembers(ctx: ServiceContext) {
  assertPermission(ctx, "accounts.read");
  const rows = await listMembers(db, ctx.organizationId);
  return rows.map((m) => ({
    ...m,
    role: m.role as RoleKey,
    segments: m.accessScope?.segments ?? [],
    lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
}

export type MemberView = Awaited<ReturnType<typeof getMembers>>[number];



function assertAssignable(ctx: ServiceContext, role: RoleKey) {
  if (ctx.role === "system") return;
  if (!canAssignRole(ctx.role, role)) throw new ForbiddenError(`Your role can't assign the ${ROLE_LABELS[role]} role.`);
}

/**
 * Invites a teammate. Email delivery isn't configured in this environment, so the
 * one-time invite link is returned to the admin to share directly.
 */
export async function inviteUser(ctx: ServiceContext, input: unknown): Promise<{ inviteToken: string }> {
  assertPermission(ctx, "users.manage");
  const values = parseInput(inviteSchema, input);
  assertAssignable(ctx, values.role);
  const token = generateToken();
  await db.transaction(async (tx) => {
    let user = await findUserByEmail(tx, values.email);
    if (user) {
      const existing = (await listMembers(tx, ctx.organizationId)).find((m) => m.userId === user!.id);
      if (existing) throw new ConflictError(`${values.email} is already a member of this workspace.`, { fieldErrors: { email: ["Already a member"] } });
    } else {
      user = await insertUser(tx, { email: values.email.toLowerCase(), name: values.name });
    }
    const membershipId = await insertMembership(tx, {
      organizationId: ctx.organizationId,
      userId: user.id,
      roleId: await findSystemRoleId(tx, values.role),
      title: values.title || null,
      status: "invited",
      accessScope: { segments: values.segments },
      inviteTokenHash: hashToken(token),
      invitedById: ctx.userId,
    });
    await recordAudit(tx, ctx, {
      action: "user.invited",
      entityType: "user",
      entityId: membershipId,
      summary: `Invited ${values.name} (${values.email}) as ${ROLE_LABELS[values.role]}${values.segments.length ? ` — ${values.segments.join(", ")}` : ""}`,
    });
  });
  return { inviteToken: token };
}


async function loadMember(ctx: ServiceContext, membershipId: string) {
  assertPermission(ctx, "users.manage");
  if (!z.string().uuid().safeParse(membershipId).success) throw new NotFoundError("Member");
  const member = await findMember(db, ctx.organizationId, membershipId);
  if (!member) throw new NotFoundError("Member");
  return member;
}

async function ownerCount(organizationId: string): Promise<number> {
  return (await listMembers(db, organizationId)).filter((m) => m.role === "owner" && m.status === "active").length;
}

export async function updateMember(ctx: ServiceContext, membershipId: string, input: unknown) {
  const member = await loadMember(ctx, membershipId);
  const values = parseInput(updateMemberSchema, input);
  assertAssignable(ctx, values.role);
  if (member.role !== values.role) assertAssignable(ctx, member.role as RoleKey);
  if (member.userId === ctx.userId && member.role !== values.role) throw new ForbiddenError("You can't change your own role.");
  if (member.role === "owner" && values.role !== "owner" && (await ownerCount(ctx.organizationId)) <= 1) throw new ConflictError("A workspace needs at least one owner.");
  await db.transaction(async (tx) => {
    await updateMembership(tx, ctx.organizationId, membershipId, { roleId: await findSystemRoleId(tx, values.role), title: values.title || null, accessScope: { segments: values.segments } });
    // Force re-authentication so new permissions apply immediately.
    if (member.role !== values.role) await deleteUserSessions(tx, member.userId, ctx.organizationId);
    await recordAudit(tx, ctx, {
      action: "user.updated",
      entityType: "user",
      entityId: membershipId,
      summary: `Updated ${member.name}: ${ROLE_LABELS[values.role]}, access ${values.segments.length ? values.segments.join(", ") : "all segments"}`,
      before: { role: member.role, segments: member.accessScope?.segments ?? [], title: member.title },
      after: values,
    });
  });
}

export async function setMemberActive(ctx: ServiceContext, membershipId: string, active: boolean) {
  const member = await loadMember(ctx, membershipId);
  if (member.userId === ctx.userId) throw new ForbiddenError("You can't deactivate yourself.");
  assertAssignable(ctx, member.role as RoleKey);
  if (!active && member.role === "owner" && (await ownerCount(ctx.organizationId)) <= 1) throw new ConflictError("A workspace needs at least one owner.");
  if (active && member.status === "invited") throw new ConflictError("This person hasn't accepted their invite yet.");
  await db.transaction(async (tx) => {
    await updateMembership(tx, ctx.organizationId, membershipId, { status: active ? "active" : "deactivated" });
    if (!active) await deleteUserSessions(tx, member.userId, ctx.organizationId);
    await recordAudit(tx, ctx, { action: active ? "user.reactivated" : "user.deactivated", entityType: "user", entityId: membershipId, summary: `${active ? "Reactivated" : "Deactivated"} ${member.name}` });
  });
}

export async function regenerateInvite(ctx: ServiceContext, membershipId: string): Promise<{ inviteToken: string }> {
  const member = await loadMember(ctx, membershipId);
  if (member.status !== "invited") throw new ConflictError("Only pending invitations can be re-sent.");
  const token = generateToken();
  await db.transaction(async (tx) => {
    await updateMembership(tx, ctx.organizationId, membershipId, { inviteTokenHash: hashToken(token), createdAt: new Date() });
    await recordAudit(tx, ctx, { action: "user.invite_regenerated", entityType: "user", entityId: membershipId, summary: `New invite link for ${member.name}` });
  });
  return { inviteToken: token };
}

export const ACTIVITY_LABELS: Record<string, string> = {
  login: "Logged in",
  dashboard: "Viewed the health dashboard",
  scorecard: "Adjusted scorecard weighting",
  audience: "Built or edited an audience",
  launch: "Launched an agent",
  approve: "Approved a Drive Outcome recommendation",
  task: "Completed a work-queue task",
  note: "Added an account note",
  review: "Reviewed a customer account",
};

export async function getMemberActivity(ctx: ServiceContext, membershipId: string, days: number) {
  const member = await loadMember(ctx, membershipId);
  const window = [30, 90, 180].includes(days) ? days : 30;
  const events = await listUserActivity(db, ctx.organizationId, member.userId, new Date(Date.now() - window * 86_400_000));
  const byType = Object.entries(ACTIVITY_LABELS)
    .map(([type, label]) => ({ type, label, count: events.filter((e) => e.type === type).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  return {
    member: { name: member.name, role: member.roleName, status: member.status, title: member.title, segments: member.accessScope?.segments ?? [] },
    window,
    total: events.length,
    activeDays: new Set(events.map((e) => e.occurredAt.toISOString().slice(0, 10))).size,
    byType,
    recent: events.slice(0, 25).map((e) => ({ id: e.id, label: ACTIVITY_LABELS[e.type] ?? e.type, occurredAt: e.occurredAt.toISOString() })),
  };
}
