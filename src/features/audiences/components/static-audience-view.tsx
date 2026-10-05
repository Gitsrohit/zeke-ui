"use client";

import { Pencil, Play, Snowflake, X } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { LaunchAgentDialog } from "@/features/agents/components/launch-agent-dialog";
import type { AudienceFilter } from "@/features/audiences/domain/types";
import { AccountMatchTable } from "./account-match-table";
import { AudienceBuilder } from "./audience-builder";
import type { BuilderContext, MatchedAccount } from "./types";

interface StaticAudienceViewProps extends BuilderContext {
  audience: { id: string; name: string; description: string | null; type: "dynamic" | "static" };
  filter: AudienceFilter;
  members: MatchedAccount[];
}

/** A static snapshot shows its frozen members; editing re-saves and takes a fresh snapshot. */
export function StaticAudienceView({ audience, filter, members, ...context }: StaticAudienceViewProps) {
  const [editing, setEditing] = useState(false);
  const [launching, setLaunching] = useState(false);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border border-border bg-primary-tint/50 px-4 py-3 text-[12.5px] text-foreground-muted">
        <Snowflake className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1">
          This is a <b className="text-foreground">static snapshot</b>: it holds the exact accounts that matched when it was saved and does not re-evaluate as scores change. Editing the definition and saving takes a fresh snapshot (or switch it to live in the save dialog).
        </p>
        <div className="flex gap-2">
          {context.canManage && (
            <Button size="sm" variant="outline" onClick={() => setEditing((e) => !e)}>
              {editing ? <X /> : <Pencil />} {editing ? "Cancel editing" : "Edit definition"}
            </Button>
          )}
          {context.canLaunch && !editing && (
            <Button size="sm" variant="accent" onClick={() => setLaunching(true)} disabled={members.length === 0}>
              <Play /> Launch agent
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <AudienceBuilder {...context} initialFilter={filter} audience={audience} />
      ) : (
        <Card>
          {members.length ? (
            <AccountMatchTable accounts={members} caption={`Frozen members of ${audience.name}`} />
          ) : (
            <EmptyState title="No members" description="None of the snapshot's accounts are visible to you, or the snapshot was empty when saved." />
          )}
        </Card>
      )}
      {launching && (
        <LaunchAgentDialog open onOpenChange={setLaunching} accountIds={members.map((m) => m.id)} agents={context.agents} audienceId={audience.id} sourceLabel={audience.name} />
      )}
    </>
  );
}
