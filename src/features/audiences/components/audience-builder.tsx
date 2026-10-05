"use client";

import { Play, Plus, RotateCcw, Save } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import { Card } from "@/components/shared/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LaunchAgentDialog } from "@/features/agents/components/launch-agent-dialog";
import type { AudienceFilter } from "@/features/audiences/domain/types";
import { AskZekePanel } from "./ask-zeke-panel";
import { AudiencePreview, MatchCount, useAudiencePreview } from "./audience-preview";
import { conditionErrors, filterReducer } from "./filter-reducer";
import { CombinatorDivider, CombinatorToggle, GroupEditor } from "./group-editor";
import { SaveAudienceDialog } from "./save-audience-dialog";
import type { BuilderContext } from "./types";

interface AudienceBuilderProps extends BuilderContext {
  initialFilter: AudienceFilter;
  audience?: { id: string; name: string; description: string | null; type: "dynamic" | "static" };
  initialPrompt?: string;
  initialTab?: "manual" | "chat";
}

export function AudienceBuilder({ initialFilter, audience, initialPrompt, initialTab = "manual", owners, agents, canManage, canLaunch }: AudienceBuilderProps) {
  const [filter, dispatch] = useReducer(filterReducer, initialFilter);
  const [tab, setTab] = useState<"manual" | "chat">(initialTab);
  const [saveOpen, setSaveOpen] = useState(false);
  const [launchIds, setLaunchIds] = useState<string[] | null>(null);
  const errors = useMemo(() => conditionErrors(filter), [filter]);
  const valid = Object.keys(errors).length === 0;
  const preview = useAudiencePreview(filter, valid);
  const ownerIds = owners.map((o) => o.id);
  const dirty = JSON.stringify(filter) !== JSON.stringify(initialFilter);

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "manual" | "chat")}>
        <TabsList>
          <TabsTrigger value="manual">Manual filters</TabsTrigger>
          <TabsTrigger value="chat">Ask Zeke</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <Card className="p-4 sm:p-[18px]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-semibold text-foreground-muted">Match accounts in</span>
              <CombinatorToggle value={filter.combinator} onChange={(c) => dispatch({ type: "setRootCombinator", combinator: c })} labels={{ or: "ANY group (OR)", and: "ALL groups (AND)" }} label="How groups combine" />
              {dirty && (
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => dispatch({ type: "replace", filter: initialFilter })}>
                  <RotateCcw /> Reset
                </Button>
              )}
            </div>
            {filter.groups.length === 0 && <p className="rounded-md bg-surface-muted p-3 text-[12.5px] text-foreground-faint">No groups — this audience matches every account. Add a group to narrow it down.</p>}
            {filter.groups.map((g, i) => (
              <div key={g.id}>
                {i > 0 && <CombinatorDivider combinator={filter.combinator} />}
                <GroupEditor group={g} depth={1} owners={owners} errors={errors} dispatch={dispatch} canRemove={filter.groups.length > 1} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-3" onClick={() => dispatch({ type: "addGroup", ownerIds })}>
              <Plus /> Add {filter.combinator.toUpperCase()} group
            </Button>
            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
              <MatchCount query={preview} valid={valid} />
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)} disabled={!valid}>
                    <Save /> {audience ? "Save changes" : "Save audience"}
                  </Button>
                )}
                {canLaunch && (
                  <Button variant="accent" size="sm" onClick={() => setLaunchIds(preview.data?.accounts.map((a) => a.id) ?? [])} disabled={!valid || !preview.data?.count}>
                    <Play /> Launch agent
                  </Button>
                )}
              </div>
            </div>
          </Card>
          <Card className="mt-4">
            <AudiencePreview query={preview} valid={valid} />
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <AskZekePanel
            owners={owners}
            initialPrompt={initialPrompt}
            canLaunch={canLaunch}
            onReview={(f) => {
              dispatch({ type: "replace", filter: f });
              setTab("manual");
            }}
            onLaunch={(ids) => setLaunchIds(ids)}
          />
        </TabsContent>
      </Tabs>

      {canManage && <SaveAudienceDialog open={saveOpen} onOpenChange={setSaveOpen} filter={filter} matchCount={preview.data?.count ?? null} audience={audience} />}
      {canLaunch && launchIds && (
        <LaunchAgentDialog
          open
          onOpenChange={(o) => !o && setLaunchIds(null)}
          accountIds={launchIds}
          agents={agents}
          sourceLabel={audience && !dirty ? audience.name : "Current filter"}
          audienceId={dirty ? null : (audience?.id ?? null)}
        />
      )}
    </>
  );
}
