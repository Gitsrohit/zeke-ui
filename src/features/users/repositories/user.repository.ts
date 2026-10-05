import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/client";
import { memberships, organizations, rolePermissions, roles, sessions, userActivityEvents, users, workspaces } from "@/lib/db/schema";
import type { RoleKey } from "@/lib/permissions";

export async function findUserByEmail(executor: DbExecutor, email: string) {
  const [row] = await executor
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

export async function findUserByGoogleSubject(executor: DbExecutor, subject: string) {
  const [row] = await executor.select().from(users).where(eq(users.googleSubject, subject)).limit(1);
  return row ?? null;
}

export async function insertUser(executor: DbExecutor, values: typeof users.$inferInsert) {
  const [row] = await executor.insert(users).values(values).returning();
  return row;
}

export async function updateUser(executor: DbExecutor, userId: string, values: Partial<typeof users.$inferInsert>) {
  await executor.update(users).set({ ...values, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** Active memberships for a user, oldest first (the first is the default organisation). */
export async function listActiveMemberships(executor: DbExecutor, userId: string) {
  return executor
    .select({ organizationId: memberships.organizationId, organizationName: organizations.name })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")))
    .orderBy(asc(memberships.createdAt));
}

export interface SessionPrincipal {
  sessionId: string;
  expiresAt: Date;
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  organizationName: string;
  workspaceName: string | null;
  membershipId: string;
  role: RoleKey;
  roleName: string;
  title: string | null;
  segmentScope: string[];
  permissions: string[];
  lastActiveAt: Date | null;
}

/** Resolves a session token hash to a principal. Returns null if expired or the membership is not active. */
export async function findSessionPrincipal(executor: DbExecutor, sessionHash: string, now: Date): Promise<SessionPrincipal | null> {
  const [row] = await executor
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      organizationId: organizations.id,
      organizationName: organizations.name,
      membershipId: memberships.id,
      roleId: roles.id,
      role: roles.key,
      roleName: roles.name,
      title: memberships.title,
      accessScope: memberships.accessScope,
      lastActiveAt: memberships.lastActiveAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(organizations, eq(sessions.organizationId, organizations.id))
    .innerJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.organizationId, organizations.id), eq(memberships.status, "active")))
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(and(eq(sessions.id, sessionHash), gte(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  const [perms, [ws]] = await Promise.all([
    executor.select({ key: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, row.roleId)),
    executor.select({ name: workspaces.name }).from(workspaces).where(and(eq(workspaces.organizationId, row.organizationId), eq(workspaces.isDefault, true))).limit(1),
  ]);
  const { roleId: _roleId, accessScope, ...rest } = row;
  return {
    ...rest,
    role: rest.role as RoleKey,
    workspaceName: ws?.name ?? null,
    segmentScope: accessScope?.segments ?? [],
    permissions: perms.map((p) => p.key),
  };
}

export async function insertSession(executor: DbExecutor, values: typeof sessions.$inferInsert) {
  await executor.insert(sessions).values(values);
}

export async function deleteSession(executor: DbExecutor, sessionHash: string) {
  await executor.delete(sessions).where(eq(sessions.id, sessionHash));
}

export async function deleteUserSessions(executor: DbExecutor, userId: string, organizationId: string) {
  await executor.delete(sessions).where(and(eq(sessions.userId, userId), eq(sessions.organizationId, organizationId)));
}

export async function touchMembership(executor: DbExecutor, membershipId: string, at: Date) {
  await executor.update(memberships).set({ lastActiveAt: at }).where(eq(memberships.id, membershipId));
}

export async function findSystemRoleId(executor: DbExecutor, key: RoleKey): Promise<string> {
  const [row] = await executor
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.key, key), eq(roles.isSystem, true)))
    .limit(1);
  if (!row) throw new Error(`System role "${key}" is missing — run the seed or migrations.`);
  return row.id;
}

export async function listMembers(executor: DbExecutor, organizationId: string) {
  return executor
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: roles.key,
      roleName: roles.name,
      title: memberships.title,
      status: memberships.status,
      accessScope: memberships.accessScope,
      lastActiveAt: memberships.lastActiveAt,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(users.name));
}

export async function findMember(executor: DbExecutor, organizationId: string, membershipId: string) {
  const rows = await listMembers(executor, organizationId);
  return rows.find((m) => m.membershipId === membershipId) ?? null;
}

export async function findMembershipByInviteHash(executor: DbExecutor, tokenHash: string) {
  const [row] = await executor
    .select({
      membershipId: memberships.id,
      organizationId: memberships.organizationId,
      organizationName: organizations.name,
      userId: users.id,
      email: users.email,
      name: users.name,
      status: memberships.status,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.inviteTokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

export async function updateMembership(executor: DbExecutor, organizationId: string, membershipId: string, values: Partial<typeof memberships.$inferInsert>) {
  await executor
    .update(memberships)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, membershipId)));
}

export async function insertMembership(executor: DbExecutor, values: typeof memberships.$inferInsert) {
  const [row] = await executor.insert(memberships).values(values).returning({ id: memberships.id });
  return row.id;
}

export async function listOrgUsers(executor: DbExecutor, organizationId: string) {
  return executor
    .select({ id: users.id, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.organizationId, organizationId), sql`${memberships.status} <> 'deactivated'`))
    .orderBy(asc(users.name));
}

export async function listUserActivity(executor: DbExecutor, organizationId: string, userId: string, since: Date) {
  return executor
    .select({ id: userActivityEvents.id, type: userActivityEvents.type, accountId: userActivityEvents.accountId, occurredAt: userActivityEvents.occurredAt })
    .from(userActivityEvents)
    .where(and(eq(userActivityEvents.organizationId, organizationId), eq(userActivityEvents.userId, userId), gte(userActivityEvents.occurredAt, since)))
    .orderBy(desc(userActivityEvents.occurredAt));
}

export async function recordUserActivity(executor: DbExecutor, values: typeof userActivityEvents.$inferInsert) {
  await executor.insert(userActivityEvents).values(values);
}
