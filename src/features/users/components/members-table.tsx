"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Activity, Link2, MoreHorizontal, Pencil, UserCheck, UserX, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AccountAvatar } from "@/components/shared/account-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Pill } from "@/components/shared/pill";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";
import { regenerateInviteAction, setMemberActiveAction } from "../actions";
import { EditMemberDialog, type EditableMember } from "./edit-member-dialog";
import { InviteLink } from "./invite-link";
import { UserActivitySheet } from "./user-activity-sheet";

export interface MemberRow {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: RoleKey;
  roleName: string;
  title: string | null;
  status: "active" | "invited" | "deactivated";
  segments: string[];
  lastActiveAt: string | null;
}

const STATUS = {
  active: { tone: "thriving", label: "Active" },
  invited: { tone: "violet", label: "Invited" },
  deactivated: { tone: "muted", label: "Deactivated" },
} as const;

export function MembersTable({ members, canManage, assignableRoles, currentUserId }: { members: MemberRow[]; canManage: boolean; assignableRoles: readonly RoleKey[]; currentUserId: string }) {
  const router = useRouter();
  const [activityFor, setActivityFor] = useState<MemberRow | null>(null);
  const [editing, setEditing] = useState<EditableMember | null>(null);
  const [toggling, setToggling] = useState<MemberRow | null>(null);
  const [inviteToken, setInviteToken] = useState<{ name: string; token: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleActive = () => {
    if (!toggling) return;
    const activate = toggling.status === "deactivated";
    startTransition(async () => {
      const result = await setMemberActiveAction(toggling.membershipId, activate);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${toggling.name} ${activate ? "reactivated" : "deactivated"}.`);
      setToggling(null);
      router.refresh();
    });
  };

  const newInvite = (m: MemberRow) =>
    startTransition(async () => {
      const result = await regenerateInviteAction(m.membershipId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInviteToken({ name: m.name, token: result.data.inviteToken });
    });

  const columns = useMemo<ColumnDef<MemberRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorFn: (m) => m.name,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <AccountAvatar name={row.original.name} />
            <div className="min-w-0">
              <div className="truncate font-semibold">
                {row.original.name}
                {row.original.userId === currentUserId && <span className="ml-1.5 text-[11px] font-normal text-foreground-faint">(you)</span>}
              </div>
              <div className="truncate text-[11.5px] text-foreground-faint">{row.original.email}</div>
            </div>
          </div>
        ),
      },
      { id: "role", header: "Role", accessorFn: (m) => ROLE_LABELS[m.role], cell: ({ row }) => <Pill tone="neutral">{ROLE_LABELS[row.original.role]}</Pill> },
      { id: "title", header: "Title", accessorFn: (m) => m.title ?? "", cell: ({ row }) => <span className="text-foreground-muted">{row.original.title ?? "—"}</span> },
      { id: "access", header: "Access", accessorFn: (m) => m.segments.join(", "), enableSorting: false, cell: ({ row }) => <span className="whitespace-nowrap">{row.original.segments.length ? row.original.segments.join(", ") : "All segments"}</span> },
      {
        id: "status",
        header: "Status",
        accessorFn: (m) => m.status,
        cell: ({ row }) => {
          const s = STATUS[row.original.status];
          return (
            <Pill tone={s.tone} dot>
              {s.label}
            </Pill>
          );
        },
      },
      {
        id: "lastActive",
        header: "Last activity",
        accessorFn: (m) => m.lastActiveAt ?? "",
        cell: ({ row }) =>
          row.original.lastActiveAt ? (
            <time dateTime={row.original.lastActiveAt} title={formatDateTime(row.original.lastActiveAt)} className="font-mono text-xs text-foreground-muted">
              {formatRelativeTime(row.original.lastActiveAt)}
            </time>
          ) : (
            <span className="text-foreground-faint">Never</span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { align: "right" },
        cell: ({ row }) => {
          const m = row.original;
          const isSelf = m.userId === currentUserId;
          const canAct = canManage && assignableRoles.includes(m.role);
          return (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setActivityFor(m)} disabled={!canManage}>
                    <Activity /> View activity
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditing({ membershipId: m.membershipId, name: m.name, role: m.role, title: m.title, segments: m.segments })} disabled={!canAct && !(canManage && isSelf)}>
                    <Pencil /> Edit role &amp; access
                  </DropdownMenuItem>
                  {m.status === "invited" && (
                    <DropdownMenuItem onSelect={() => newInvite(m)} disabled={!canManage || pending}>
                      <Link2 /> Copy new invite link
                    </DropdownMenuItem>
                  )}
                  {m.status !== "invited" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setToggling(m)} disabled={!canAct || isSelf} className={m.status === "active" ? "text-critical" : undefined}>
                        {m.status === "active" ? <UserX /> : <UserCheck />}
                        {m.status === "active" ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [assignableRoles, canManage, currentUserId, pending],
  );

  return (
    <>
      <DataTable
        caption="Workspace members"
        columns={columns}
        data={members}
        getRowId={(m) => m.membershipId}
        onRowClick={canManage ? (m) => setActivityFor(m) : undefined}
        enableColumnVisibility={false}
        empty={<EmptyState icon={Users} title="No members yet" description="Invite a teammate to get started." />}
      />
      {canManage && <p className="mt-2 text-[11.5px] text-foreground-faint">Click any teammate to see their platform activity.</p>}

      <UserActivitySheet member={activityFor} onOpenChange={(o) => !o && setActivityFor(null)} />
      <EditMemberDialog member={editing} assignableRoles={assignableRoles} isSelf={editing ? members.find((m) => m.membershipId === editing.membershipId)?.userId === currentUserId : false} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={Boolean(toggling)}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.status === "deactivated" ? `Reactivate ${toggling?.name}?` : `Deactivate ${toggling?.name}?`}
        description={
          toggling?.status === "deactivated"
            ? "They'll be able to sign in again with their existing role and access."
            : "They'll be signed out immediately and can't sign in until reactivated. Their accounts and history are kept."
        }
        confirmLabel={toggling?.status === "deactivated" ? "Reactivate" : "Deactivate"}
        tone={toggling?.status === "deactivated" ? "default" : "destructive"}
        loading={pending}
        onConfirm={toggleActive}
      />
      <Dialog open={Boolean(inviteToken)} onOpenChange={(o) => !o && setInviteToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New invite link for {inviteToken?.name}</DialogTitle>
            <DialogDescription>The previous link no longer works.</DialogDescription>
          </DialogHeader>
          {inviteToken && <InviteLink token={inviteToken.token} />}
          <DialogFooter>
            <Button onClick={() => setInviteToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
