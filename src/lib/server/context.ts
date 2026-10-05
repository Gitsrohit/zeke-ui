import { ForbiddenError } from "@/lib/errors";
import { hasPermission, type Permission, type RoleKey } from "@/lib/permissions";

/**
 * Everything a service needs to know about who is acting and on which tenant.
 * Built server-side from the session — never from client input.
 */
export interface ServiceContext {
  organizationId: string;
  userId: string | null;
  userName: string;
  role: RoleKey | "system";
  permissions: readonly Permission[];
  /** Segments this member may see; empty = all. */
  segmentScope: readonly string[];
  request?: { ipAddress?: string | null; userAgent?: string | null };
}

export function assertPermission(ctx: ServiceContext, permission: Permission): void {
  if (!hasPermission(ctx.permissions, permission)) throw new ForbiddenError();
}

export function can(ctx: ServiceContext, permission: Permission): boolean {
  return hasPermission(ctx.permissions, permission);
}

/** Context for background jobs (scheduler, seeding). Holds every permission. */
export function systemContext(organizationId: string, permissions: readonly Permission[]): ServiceContext {
  return { organizationId, userId: null, userName: "Zeke Automation", role: "system", permissions, segmentScope: [] };
}
