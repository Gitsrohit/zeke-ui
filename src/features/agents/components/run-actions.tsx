"use client";

import { FastForward, OctagonX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { skipWaitAction, stopRunAction } from "../actions";

/** Manager overrides for an active run. */
export function RunActions({ runId, waiting }: { runId: string; waiting: boolean }) {
  const router = useRouter();
  const [stopOpen, setStopOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [skipping, startSkip] = useTransition();
  const [stopping, startStop] = useTransition();

  const skip = () =>
    startSkip(async () => {
      const r = await skipWaitAction(runId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Wait skipped — the run continued to the next step.");
      router.refresh();
    });

  const stop = () =>
    startStop(async () => {
      const r = await stopRunAction(runId, reason);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Run stopped. Open work items were cancelled.");
      setStopOpen(false);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      {waiting && (
        <Button variant="outline" size="sm" onClick={skip} loading={skipping}>
          {!skipping && <FastForward />} Skip wait
        </Button>
      )}
      <Button variant="destructive" size="sm" onClick={() => setStopOpen(true)}>
        <OctagonX /> Stop run
      </Button>
      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Stop this run?"
        description="Remaining steps are skipped and any open work items for this run are cancelled. This can't be undone."
        confirmLabel="Stop run"
        tone="destructive"
        loading={stopping}
        onConfirm={stop}
      >
        <label htmlFor="stop-reason" className="text-xs font-semibold text-foreground-muted">
          Reason (recorded in the audit log)
        </label>
        <Input id="stop-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked us to pause outreach" />
      </ConfirmDialog>
    </div>
  );
}
