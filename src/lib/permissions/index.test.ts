import { describe, expect, it } from "vitest";
import { canAssignRole, hasAnyPermission, hasPermission, PERMISSIONS, ROLE_KEYS, ROLE_PERMISSIONS } from "./index";

describe("permissions", () => {
  it("owner and admin hold every permission", () => {
    for (const p of PERMISSIONS) {
      expect(hasPermission(ROLE_PERMISSIONS.owner, p)).toBe(true);
      expect(hasPermission(ROLE_PERMISSIONS.admin, p)).toBe(true);
    }
  });

  it("viewer is read-only", () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual(["accounts.read"]);
    expect(hasPermission(ROLE_PERMISSIONS.viewer, "accounts.write")).toBe(false);
    expect(hasPermission(ROLE_PERMISSIONS.viewer, "agents.launch")).toBe(false);
  });

  it("CSMs can launch agents and work their queue but cannot manage config, users or audit", () => {
    const csm = ROLE_PERMISSIONS.csm;
    expect(hasPermission(csm, "agents.launch")).toBe(true);
    expect(hasPermission(csm, "work.manage")).toBe(true);
    expect(hasAnyPermission(csm, ["scorecards.manage", "integrations.manage", "users.manage", "audit.read", "agents.manage"])).toBe(false);
  });

  it("CS managers can tune scorecards and agents but not integrations or users", () => {
    const m = ROLE_PERMISSIONS.cs_manager;
    expect(hasPermission(m, "scorecards.manage")).toBe(true);
    expect(hasPermission(m, "agents.manage")).toBe(true);
    expect(hasPermission(m, "audit.read")).toBe(true);
    expect(hasPermission(m, "integrations.manage")).toBe(false);
    expect(hasPermission(m, "users.manage")).toBe(false);
  });

  it("every role only references known permissions", () => {
    for (const role of ROLE_KEYS) {
      for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
    }
  });

  it("prevents privilege escalation when assigning roles", () => {
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "csm")).toBe(true);
    expect(canAssignRole("cs_manager", "viewer")).toBe(false);
  });
});
