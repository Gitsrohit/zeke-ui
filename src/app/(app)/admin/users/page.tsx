import { SectionTitle } from "@/components/shared/section-title";
import { getMembers } from "@/features/users/services/user.service";
import { InviteUserDialog } from "@/features/users/components/invite-user-dialog";
import { MembersTable } from "@/features/users/components/members-table";
import { RolesMatrix } from "@/features/users/components/roles-matrix";
import { getServiceContext } from "@/lib/auth/session";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { can } from "@/lib/server/context";
import { Users } from "lucide-react";

export const metadata = { title: "Users & roles" };

export default async function AdminUsersPage() {
  const ctx = await getServiceContext();
  const members = await getMembers(ctx);
  const canManage = can(ctx, "users.manage");
  const assignable = canManage && ctx.role !== "system" ? ASSIGNABLE_ROLES[ctx.role] : [];

  return (
    <>
      <SectionTitle
        icon={Users}
        className="mt-0"
        hint={`${members.filter((m) => m.status === "active").length} active · ${members.filter((m) => m.status === "invited").length} invited`}
        actions={canManage ? <InviteUserDialog assignableRoles={assignable} /> : undefined}
      >
        Users &amp; roles
      </SectionTitle>
      {!canManage && (
        <p className="mb-3 rounded-md border border-border bg-surface-muted px-3 py-2 text-[12.5px] text-foreground-muted">
          You can see who&apos;s in this workspace. Inviting and managing users requires <code className="font-mono text-[11.5px] text-foreground">users.manage</code>.
        </p>
      )}
      <MembersTable members={members} canManage={canManage} assignableRoles={assignable} currentUserId={ctx.userId ?? ""} />
      <RolesMatrix />
    </>
  );
}
