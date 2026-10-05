import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@/lib/db/client";
import { memberships, organizations, roles, users } from "@/lib/db/schema";
import { seedDatabase } from "@/lib/db/seed/seed";
import { isRoleKey, ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/server/context";
import { resetRateLimits } from "@/lib/rate-limit";

let prepared = false;

export async function prepareDatabase(): Promise<void> {
  if (!prepared) {
    await migrate(db, { migrationsFolder: "drizzle" });
    prepared = true;
  }
  await seedDatabase({ passwordHashCost: 4 });
  resetRateLimits();
}

/** Builds a real service context for a seeded user, exactly as a session would. */
export async function contextFor(email: string, overrides: Partial<ServiceContext> = {}): Promise<ServiceContext> {
  const [row] = await db
    .select({ userId: users.id, name: users.name, orgId: organizations.id, role: roles.key, scope: memberships.accessScope })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(and(eq(users.email, email)))
    .limit(1);
  if (!row || !isRoleKey(row.role)) throw new Error(`No seeded member ${email}`);
  return {
    organizationId: row.orgId,
    userId: row.userId,
    userName: row.name,
    role: row.role,
    permissions: ROLE_PERMISSIONS[row.role] as Permission[],
    segmentScope: row.scope?.segments ?? [],
    ...overrides,
  };
}
