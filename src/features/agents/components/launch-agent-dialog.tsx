"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { postJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { pluralize } from "@/lib/utils/format";
import { launchAgentAction } from "../actions";

export interface LaunchableAgent {
  id: string;
  name: string;
  category?: string;
}

interface LaunchPreview {
  agent: { id: string; name: string };
  eligibleCount: number;
  skipped: Array<{ accountId: string; accountName: string; reason: string; code: string }>;
}

interface LaunchAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountIds: string[];
  sourceLabel: string;
  agents: LaunchableAgent[];
  defaultAgentId?: string | null;
  audienceId?: string | null;
  /** Context line, e.g. "from Enterprise · At Risk". */
  description?: string;
  onLaunched?: (launchedAccountIds: string[]) => void;
}

/**
 * Human-in-the-loop launch: shows exactly which accounts orchestration will enroll
 * or skip (and why) before anything runs. Used everywhere an agent can be launched.
 */
export function LaunchAgentDialog({ open, onOpenChange, accountIds, sourceLabel, agents, defaultAgentId, audienceId, description, onLaunched }: LaunchAgentDialogProps) {
  const router = useRouter();
  const [agentId, setAgentId] = useState<string>(defaultAgentId ?? agents[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const selectedAgentId = agents.some((a) => a.id === agentId) ? agentId : (defaultAgentId ?? agents[0]?.id ?? "");

  const preview = useQuery({
    queryKey: ["launch-preview", selectedAgentId, accountIds],
    queryFn: () => postJson<LaunchPreview>(API.launchPreview, { agentId: selectedAgentId, accountIds }),
    enabled: open && Boolean(selectedAgentId) && accountIds.length > 0,
  });

  const confirm = () =>
    startTransition(async () => {
      const result = await launchAgentAction({ agentId: selectedAgentId, accountIds, audienceId: audienceId ?? null, sourceLabel });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { launched, skipped } = result.data;
      toast.success(`${preview.data?.agent.name ?? "Agent"} launched for ${pluralize(launched.length, "account")}${skipped.length ? ` · ${skipped.length} skipped by orchestration rules` : ""}.`, {
        action: launched.length ? { label: "Open My Work", onClick: () => router.push("/my-work") } : undefined,
      });
      onLaunched?.(launched.map((l) => l.accountId));
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Launch an agent</DialogTitle>
          <DialogDescription>
            Enroll {pluralize(accountIds.length, "account")} {description ?? `from ${sourceLabel}`}. Nothing runs until you confirm.
          </DialogDescription>
        </DialogHeader>
        {agents.length === 0 ? (
          <p className="rounded-md bg-surface-muted p-3 text-[12.5px] text-foreground-muted">No active agents yet. Create one in Agents first.</p>
        ) : (
          <div>
            <label htmlFor="launch-agent" className="mb-1.5 block text-xs font-semibold text-foreground-muted">
              Agent
            </label>
            <Select value={selectedAgentId} onValueChange={setAgentId}>
              <SelectTrigger id="launch-agent" className="w-full">
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.category ? <span className="ml-1 text-foreground-faint">· {a.category}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="min-h-[56px] rounded-md border border-border bg-surface-muted p-3 text-[12.5px]" aria-live="polite">
          {preview.isFetching ? (
            <span className="flex items-center gap-2 text-foreground-faint">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking orchestration rules…
            </span>
          ) : preview.isError ? (
            <span className="text-critical">{preview.error instanceof Error ? preview.error.message : "Couldn't check eligibility."}</span>
          ) : preview.data ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-thriving" aria-hidden />
                {pluralize(preview.data.eligibleCount, "account")} will be enrolled
              </p>
              {preview.data.skipped.length > 0 && (
                <div>
                  <p className="flex items-center gap-2 font-semibold text-at-risk">
                    <AlertTriangle className="size-4" aria-hidden /> {preview.data.skipped.length} will be skipped
                  </p>
                  <ul className="mt-1.5 max-h-36 space-y-1 overflow-y-auto pl-6 text-foreground-muted">
                    {preview.data.skipped.map((s) => (
                      <li key={s.accountId}>
                        <b className="font-semibold text-foreground">{s.accountName}</b> is {s.reason}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="accent" onClick={confirm} loading={pending} disabled={!selectedAgentId || !preview.data || preview.data.eligibleCount === 0}>
            {!pending && <Play />} Confirm & launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
