import type { AccountDetail } from "@/features/accounts/services/account.service";

export type TimelineKind = "event" | "note" | "activity" | "work";

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  icon: string;
  title: string;
  detail: string | null;
  actor: string | null;
  at: string;
  href?: string;
}

/** Merges timeline events, notes, activities and completed work into one newest-first feed. */
export function buildTimeline(detail: Pick<AccountDetail, "timeline" | "notes" | "activities" | "completedWork">, limit = 80): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...detail.timeline.map((t) => ({
      id: `t-${t.id}`,
      kind: "event" as const,
      icon: t.kind,
      title: t.title,
      detail: t.description,
      actor: t.actorName,
      at: t.occurredAt,
      href: t.entityType === "agent_run" && t.entityId ? `/agents/runs/${t.entityId}` : undefined,
    })),
    ...detail.notes.map((n) => ({ id: `n-${n.id}`, kind: "note" as const, icon: "note", title: "Note added", detail: n.body, actor: n.authorName, at: n.createdAt })),
    ...detail.activities.map((a) => ({ id: `a-${a.id}`, kind: "activity" as const, icon: a.type, title: a.subject, detail: a.body, actor: a.userName, at: a.occurredAt })),
    ...detail.completedWork
      .filter((w) => w.completedAt)
      .map((w) => ({ id: `w-${w.id}`, kind: "work" as const, icon: "work", title: `Completed: ${w.title}`, detail: w.resolution, actor: w.ownerName, at: w.completedAt! })),
  ];
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
