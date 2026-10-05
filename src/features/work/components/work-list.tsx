"use client";

import {
  AlarmClock,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  ListChecks,
  Mail,
  MoreHorizontal,
  Phone,
  Search,
  ShieldCheck,
  UserRoundPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/shared/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreBadge } from "@/components/shared/health-badge";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { HealthBandKey } from "@/config/health";
import type { WorkItemView } from "@/features/work/services/work.service";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";
import { completeWorkItemAction, reassignWorkItemAction, snoozeWorkItemAction } from "../actions";

const TYPE_META: Record<WorkItemView["type"], { icon: LucideIcon; label: string; tile: string }> = {
  task: { icon: ListChecks, label: "Task", tile: "bg-primary-tint text-primary" },
  email: { icon: Mail, label: "Email", tile: "bg-violet-tint text-violet-deep" },
  call: { icon: Phone, label: "Call", tile: "bg-thriving-tint text-thriving" },
  review: { icon: Search, label: "Review", tile: "bg-stable-tint text-stable" },
  approval: { icon: ShieldCheck, label: "Approval", tile: "bg-at-risk-tint text-at-risk" },
  decision: { icon: GitBranch, label: "Decision", tile: "bg-[#edeafb] text-[#5b45c4]" },
  follow_up: { icon: ClipboardCheck, label: "Follow-up", tile: "bg-surface-muted text-foreground-muted ring-1 ring-border" },
};

const PRIORITY_TONE = { high: "critical", medium: "stable", low: "muted" } as const;

type Resolution = "complete" | "approve" | "reject" | "yes" | "no";

const SUCCESS_MESSAGE: Record<Resolution, (item: WorkItemView) => string> = {
  complete: (i) => (i.agentRunId ? "Marked complete — the agent moved to its next step." : "Marked complete."),
  approve: (i) => (i.agentRunId ? "Approved — the agent continued." : "Approved."),
  reject: (i) => (i.agentRunId ? "Rejected — the agent run was stopped for this account." : "Rejected."),
  yes: () => "Decision recorded (Yes) — the agent continued down that branch.",
  no: () => "Decision recorded (No) — the agent continued down that branch.",
};

interface WorkListProps {
  items: WorkItemView[];
  owners: Array<{ id: string; name: string }>;
  view: "open" | "snoozed" | "completed";
  currentUserId: string | null;
  canManage: boolean;
  canActOnOthers: boolean;
  emptyHint: string;
}

export function WorkList({ items, owners, view, currentUserId, canManage, canActOnOthers, emptyHint }: WorkListProps) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !removed.has(i.id));
  const hide = (id: string) => setRemoved((r) => new Set(r).add(id));
  const restore = (id: string) =>
    setRemoved((r) => {
      const next = new Set(r);
      next.delete(id);
      return next;
    });

  if (visible.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle2}
          title={view === "completed" ? "Nothing completed yet" : view === "snoozed" ? "Nothing snoozed" : "Queue is clear"}
          description={view === "open" ? emptyHint : view === "snoozed" ? "Snoozed items come back to the open queue automatically." : "Completed items for these filters will appear here."}
        />
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5" aria-label="Work items">
      {visible.map((item) => (
        <WorkItemCard
          key={item.id}
          item={item}
          owners={owners}
          editable={canManage && view !== "completed" && (!item.ownerId || item.ownerId === currentUserId || canActOnOthers)}
          onRemove={hide}
          onRestore={restore}
        />
      ))}
    </ul>
  );
}

function WorkItemCard({ item, owners, editable, onRemove, onRestore }: { item: WorkItemView; owners: Array<{ id: string; name: string }>; editable: boolean; onRemove: (id: string) => void; onRestore: (id: string) => void }) {
  const meta = TYPE_META[item.type];
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const run = (label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) =>
    startTransition(async () => {
      onRemove(item.id);
      const result = await fn();
      if (!result.ok) {
        onRestore(item.id);
        toast.error(`${label} failed: ${result.error}`);
        return;
      }
      toast.success(success);
    });

  const resolve = (resolution: Resolution, note?: string) =>
    run("Update", () => completeWorkItemAction(item.id, { resolution, note }), SUCCESS_MESSAGE[resolution](item));

  const snooze = (days: number) => run("Snooze", () => snoozeWorkItemAction(item.id, { days }), `Snoozed for ${days} day${days === 1 ? "" : "s"} — it will return to the queue automatically.`);

  return (
    <li>
      <Card className={cn("flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center", pending && "opacity-60")}>
        <div className="flex min-w-0 flex-1 gap-3.5">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[7px]", meta.tile)} aria-hidden>
            <meta.icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-mono text-[10.5px] font-semibold tracking-wide text-foreground-faint uppercase">{meta.label}</span>
              {item.accountId && item.accountName && (
                <Link href={`/accounts/${item.accountId}`} className="font-semibold text-foreground hover:underline">
                  {item.accountName}
                </Link>
              )}
              {item.accountScore !== null && item.accountBand && <ScoreBadge score={item.accountScore} band={item.accountBand as HealthBandKey} size="sm" />}
              {item.agentName && item.agentRunId && (
                <Link href={`/agents/runs/${item.agentRunId}`} className="inline-flex items-center gap-1 text-foreground-faint hover:text-primary hover:underline">
                  <Bot className="size-3" aria-hidden /> {item.agentName}
                </Link>
              )}
            </div>
            <p className="text-[13px] font-semibold">{item.title}</p>
            {item.description && <p className="mt-0.5 truncate text-xs text-foreground-muted">{item.description}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-foreground-faint">
              {item.status === "completed" ? (
                <span className="font-mono">
                  {item.resolution ?? "Completed"}
                  {item.completedAt ? ` · ${formatDateTime(item.completedAt)}` : ""}
                </span>
              ) : item.status === "snoozed" && item.snoozedUntil ? (
                <span className="inline-flex items-center gap-1 font-mono">
                  <AlarmClock className="size-3" aria-hidden /> Snoozed until {formatDateTime(item.snoozedUntil)}
                </span>
              ) : item.dueAt ? (
                item.overdue ? (
                  <span className="font-mono font-semibold text-critical">Overdue · due {formatRelativeTime(item.dueAt)}</span>
                ) : (
                  <span className="font-mono">Due {formatRelativeTime(item.dueAt)}</span>
                )
              ) : (
                <span className="font-mono">No due date</span>
              )}
              <span aria-hidden>·</span>
              <span>{item.ownerName ?? "Unassigned"}</span>
              <Pill tone={item.source === "agent" ? "violet" : "muted"}>{item.source === "agent" ? "Agent" : "Manual"}</Pill>
              <Pill tone={PRIORITY_TONE[item.priority]}>{item.priority === "high" ? "High" : item.priority === "medium" ? "Medium" : "Low"} priority</Pill>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
          {editable && item.status !== "completed" && (
            <>
              {item.type === "decision" ? (
                <>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => resolve("no")}>
                    No
                  </Button>
                  <Button variant="accent" size="sm" disabled={pending} onClick={() => resolve("yes")}>
                    Yes
                  </Button>
                </>
              ) : item.type === "approval" ? (
                <>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setRejectOpen(true)}>
                    <X /> Reject
                  </Button>
                  <Button variant="accent" size="sm" disabled={pending} onClick={() => resolve("approve")}>
                    <Check /> {item.title.toLowerCase().startsWith("approve email") ? "Approve & send" : "Approve"}
                  </Button>
                </>
              ) : (
                <Button variant="accent" size="sm" disabled={pending} onClick={() => resolve("complete")}>
                  <Check /> Mark complete
                </Button>
              )}
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${item.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {editable && item.status !== "completed" && (
                <>
                  <DropdownMenuLabel className="text-label">Snooze</DropdownMenuLabel>
                  {[1, 3, 7].map((d) => (
                    <DropdownMenuItem key={d} onSelect={() => snooze(d)}>
                      <AlarmClock /> {d === 1 ? "1 day" : `${d} days`}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setReassignOpen(true)}>
                    <UserRoundPlus /> Reassign…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {item.accountId && (
                <DropdownMenuItem asChild>
                  <Link href={`/accounts/${item.accountId}`}>
                    <Building2 /> Open account
                  </Link>
                </DropdownMenuItem>
              )}
              {item.agentRunId && (
                <DropdownMenuItem asChild>
                  <Link href={`/agents/runs/${item.agentRunId}`}>
                    <Bot /> Open agent run
                  </Link>
                </DropdownMenuItem>
              )}
              {!item.accountId && !item.agentRunId && !editable && <DropdownMenuItem disabled>No actions available</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
      {rejectOpen && <RejectDialog item={item} onClose={() => setRejectOpen(false)} onConfirm={(note) => { setRejectOpen(false); resolve("reject", note); }} />}
      {reassignOpen && (
        <ReassignDialog
          item={item}
          owners={owners}
          onClose={() => setReassignOpen(false)}
          onReassigned={(ownerId) => {
            const name = owners.find((o) => o.id === ownerId)?.name ?? "teammate";
            setReassignOpen(false);
            run("Reassign", () => reassignWorkItemAction(item.id, { ownerId }), `Reassigned to ${name}.`);
          }}
        />
      )}
    </li>
  );
}

function RejectDialog({ item, onClose, onConfirm }: { item: WorkItemView; onClose: () => void; onConfirm: (note?: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Reject this item?"
      description={item.agentRunId ? `Rejecting stops ${item.agentName ?? "the agent"} for ${item.accountName ?? "this account"}. Remaining steps are skipped.` : "This closes the item as rejected."}
      tone="destructive"
      confirmLabel="Reject"
      confirmIcon={<X />}
      onConfirm={() => onConfirm(note.trim() || undefined)}
    >
      <div>
        <label htmlFor={`reject-${item.id}`} className="mb-1.5 block text-xs font-semibold text-foreground-muted">
          Note (optional)
        </label>
        <Textarea id={`reject-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Why are you rejecting this?" />
      </div>
    </ConfirmDialog>
  );
}

function ReassignDialog({ item, owners, onClose, onReassigned }: { item: WorkItemView; owners: Array<{ id: string; name: string }>; onClose: () => void; onReassigned: (ownerId: string) => void }) {
  const [ownerId, setOwnerId] = useState<string>("");
  const choices = owners.filter((o) => o.id !== item.ownerId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign item</DialogTitle>
          <DialogDescription>
            &ldquo;{item.title}&rdquo; is currently assigned to {item.ownerName ?? "nobody"}. The new owner gets a notification.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor={`reassign-${item.id}`} className="mb-1.5 block text-xs font-semibold text-foreground-muted">
            New owner
          </label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger id={`reassign-${item.id}`} className="w-full">
              <SelectValue placeholder="Choose a teammate" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!ownerId} onClick={() => onReassigned(ownerId)}>
            <UserRoundPlus /> Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
