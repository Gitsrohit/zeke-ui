"use client";

import { ArrowRight, Loader2, Play, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Chip, Pill } from "@/components/shared/pill";
import { Card } from "@/components/shared/card";
import { Button } from "@/components/ui/button";
import { LaunchAgentDialog, type LaunchableAgent } from "@/features/agents/components/launch-agent-dialog";
import { formatRelativeTime, pluralize } from "@/lib/utils/format";
import { deleteAudienceAction, resolveAudienceMembersAction } from "../actions";

export interface AudienceCard {
  id: string;
  name: string;
  description: string | null;
  type: "dynamic" | "static";
  chips: string[];
  conditionCount: number;
  groupCount: number;
  memberCount: number;
  lastEvaluatedAt: string | null;
  createdByName: string | null;
}

export function AudienceLibrary({ audiences, agents, canManage, canLaunch }: { audiences: AudienceCard[]; agents: LaunchableAgent[]; canManage: boolean; canLaunch: boolean }) {
  const router = useRouter();
  const [toDelete, setToDelete] = useState<AudienceCard | null>(null);
  const [launch, setLaunch] = useState<{ audience: AudienceCard; ids: string[] } | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const openLaunch = async (a: AudienceCard) => {
    setResolving(a.id);
    const result = await resolveAudienceMembersAction(a.id);
    setResolving(null);
    if (!result.ok) return void toast.error(result.error);
    if (result.data.accountIds.length === 0) return void toast.info(`${a.name} has no matching accounts right now.`);
    setLaunch({ audience: a, ids: result.data.accountIds });
  };

  if (audiences.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Target}
          title="No saved audiences yet"
          description="Build one manually or with Ask Zeke, then save it here for one-click reuse."
          action={
            canManage ? (
              <Button asChild size="sm">
                <Link href="/audiences/new">New audience</Link>
              </Button>
            ) : undefined
          }
        />
      </Card>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {audiences.map((a) => (
          <li key={a.id} className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-4 transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-pop">
            <div className="flex items-start justify-between gap-2">
              <Pill tone={a.type === "static" ? "neutral" : "thriving"} dot>
                {a.type === "static" ? "Static snapshot" : "Live"}
              </Pill>
              {a.lastEvaluatedAt && <span className="font-mono text-[10.5px] text-foreground-faint">evaluated {formatRelativeTime(a.lastEvaluatedAt)}</span>}
            </div>
            <h3 className="text-[14.5px] font-semibold">
              <Link href={`/audiences/${a.id}`} className="hover:text-primary">
                {a.name}
              </Link>
            </h3>
            {a.description && <p className="text-[12.5px] text-foreground-muted">{a.description}</p>}
            <div className="flex flex-wrap gap-1.5">
              {a.chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
              {a.conditionCount > a.chips.length && <Chip>+{a.conditionCount - a.chips.length} more</Chip>}
              {a.conditionCount === 0 && <span className="text-xs text-foreground-faint">No conditions — matches every account</span>}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-border pt-2.5 font-mono text-[11.5px] text-foreground-faint">
              <span>
                <b className="text-[15px] text-foreground">{a.memberCount}</b> accounts{a.groupCount > 1 ? ` across ${a.groupCount} OR groups` : ""}
              </span>
              {a.createdByName && <span className="truncate pl-2">{a.createdByName}</span>}
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/audiences/${a.id}`}>
                  <ArrowRight /> Open
                </Link>
              </Button>
              {canLaunch && (
                <Button variant="accent" size="sm" onClick={() => void openLaunch(a)} disabled={resolving === a.id}>
                  {resolving === a.id ? <Loader2 className="animate-spin" /> : <Play />} Launch
                </Button>
              )}
              {canManage && (
                <Button variant="ghost" size="icon-sm" className="ml-auto text-critical hover:bg-critical-tint hover:text-critical" onClick={() => setToDelete(a)} aria-label={`Delete ${a.name}`}>
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description="This removes it from the library. Any agents currently attached to it will need a new audience. Running agent runs are not affected."
        confirmLabel="Delete"
        tone="destructive"
        loading={deleting}
        confirmIcon={<Trash2 />}
        onConfirm={() =>
          startDelete(async () => {
            if (!toDelete) return;
            const result = await deleteAudienceAction(toDelete.id);
            if (!result.ok) return void toast.error(result.error);
            toast.success("Audience deleted.");
            setToDelete(null);
            router.refresh();
          })
        }
      />
      {launch && (
        <LaunchAgentDialog
          open
          onOpenChange={(o) => !o && setLaunch(null)}
          accountIds={launch.ids}
          agents={agents}
          audienceId={launch.audience.id}
          sourceLabel={launch.audience.name}
          description={`in ${launch.audience.name} (${pluralize(launch.ids.length, "member")})`}
        />
      )}
    </>
  );
}
