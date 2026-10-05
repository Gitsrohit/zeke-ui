/**
 * Centralised permission model. System role → permission grants are defined
 * here and seeded into the database (roles / role_permissions); sessions resolve
 * a member's effective permissions from the database at sign-in time.
 */

export const PERMISSIONS = [
  "accounts.read",
  "accounts.write",
  "scorecards.manage",
  "audiences.manage",
  "agents.launch",
  "agents.manage",
  "work.manage",
  "integrations.manage",
  "users.manage",
  "audit.read",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "accounts.read": "View accounts, contacts, health scores and activity",
  "accounts.write": "Create and edit accounts, notes, tasks and contacts",
  "scorecards.manage": "Change scorecard weights and health band thresholds",
  "audiences.manage": "Create, edit and delete audiences",
  "agents.launch": "Launch agents against accounts and audiences",
  "agents.manage": "Create and edit agents, override waits and stop runs",
  "work.manage": "Complete, snooze and reassign work items",
  "integrations.manage": "Connect, configure and disconnect integrations",
  "users.manage": "Invite users, change roles and deactivate users",
  "audit.read": "View the audit log",
  "settings.manage": "Change workspace configuration",
};

export const ROLE_KEYS = ["owner", "admin", "cs_manager", "csm", "viewer"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  owner: "Owner",
  admin: "Admin",
  cs_manager: "CS Manager",
  csm: "CSM",
  viewer: "Viewer",
};

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  owner: ALL,
  admin: ALL,
  cs_manager: [
    "accounts.read",
    "accounts.write",
    "scorecards.manage",
    "audiences.manage",
    "agents.launch",
    "agents.manage",
    "work.manage",
    "audit.read",
  ],
  csm: ["accounts.read", "accounts.write", "audiences.manage", "agents.launch", "work.manage"],
  viewer: ["accounts.read"],
};

/** Roles a given role is allowed to assign. Prevents privilege escalation via invites. */
export const ASSIGNABLE_ROLES: Record<RoleKey, readonly RoleKey[]> = {
  owner: ROLE_KEYS,
  admin: ["admin", "cs_manager", "csm", "viewer"],
  cs_manager: [],
  csm: [],
  viewer: [],
};

export function hasPermission(granted: readonly string[], permission: Permission): boolean {
  return granted.includes(permission);
}

export function hasAnyPermission(granted: readonly string[], permissions: readonly Permission[]): boolean {
  return permissions.some((p) => granted.includes(p));
}

export function canAssignRole(actorRole: RoleKey, targetRole: RoleKey): boolean {
  return ASSIGNABLE_ROLES[actorRole].includes(targetRole);
}

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}
