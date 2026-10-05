"use client";

import { Info, Plug, RefreshCw, Settings2, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/format";
import { configureIntegrationAction, connectIntegrationAction, disconnectIntegrationAction, syncIntegrationAction } from "../actions";

export interface IntegrationCardData {
  key: string;
  name: string;
  code: string;
  category: string;
  description: string;
  status: "connected" | "disconnected" | "error";
  feeds: string[];
  config: { syncFrequency: "hourly" | "daily" | "weekly" } | null;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  connectedAt: string | null;
  connectedByName: string | null;
}

const FREQUENCIES = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
] as const;

export function IntegrationCard({ integration: it, canManage }: { integration: IntegrationCardData; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [frequency, setFrequency] = useState(it.config?.syncFrequency ?? "daily");
  const connected = it.status === "connected";

  const run = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, success: (data: unknown) => string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success(result.data));
      after?.();
      router.refresh();
    });

  return (
    <article className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface px-4 py-[15px]" aria-label={it.name}>
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="flex size-[34px] items-center justify-center rounded-lg bg-primary-tint font-display text-[13px] font-bold text-primary">
          {it.code}
        </span>
        <Pill tone="muted">{it.category}</Pill>
      </div>
      <div>
        <h3 className="text-[13.5px] font-semibold">{it.name}</h3>
        <p className="text-[11.5px] text-foreground-faint">{it.description}</p>
        {it.feeds.length > 0 && <p className="mt-1 text-[11.5px] text-foreground-muted">Feeds: {it.feeds.join(", ")}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("font-mono text-[11px] font-semibold", connected ? "text-thriving" : it.status === "error" ? "text-critical" : "text-foreground-faint")}>
          {connected ? "● Connected" : it.status === "error" ? "▲ Error" : "○ Not connected"}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`Status details for ${it.name}`}>
              <Info />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 text-[12.5px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-foreground-faint">Status</dt>
              <dd className="font-semibold capitalize">{it.status}</dd>
              <dt className="text-foreground-faint">Schedule</dt>
              <dd className="capitalize">{it.config?.syncFrequency ?? "daily"}</dd>
              <dt className="text-foreground-faint">Last sync</dt>
              <dd>{it.lastSyncedAt ? formatDateTime(it.lastSyncedAt) : "Never"}</dd>
              <dt className="text-foreground-faint">Result</dt>
              <dd>{it.lastSyncStatus ?? "—"}</dd>
              <dt className="text-foreground-faint">Connected</dt>
              <dd>{it.connectedAt ? `${formatDateTime(it.connectedAt)}${it.connectedByName ? ` by ${it.connectedByName}` : ""}` : "—"}</dd>
            </dl>
          </PopoverContent>
        </Popover>
      </div>
      {connected && (
        <p className="-mt-1.5 text-[11px] text-foreground-faint">
          {it.lastSyncedAt ? (
            <>
              Synced <time dateTime={it.lastSyncedAt} title={formatDateTime(it.lastSyncedAt)}>{formatRelativeTime(it.lastSyncedAt)}</time>
              {it.lastSyncStatus ? ` · ${it.lastSyncStatus}` : ""}
            </>
          ) : (
            (it.lastSyncStatus ?? "Not synced yet")
          )}
        </p>
      )}
      {canManage && (
        <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border pt-2.5">
          {connected ? (
            <>
              <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => syncIntegrationAction(it.key), (d) => `${it.name}: ${(d as { status: string }).status}.`)}>
                <RefreshCw className={cn(pending && "animate-spin")} /> Sync now
              </Button>
              <Button size="xs" variant="ghost" disabled={pending} onClick={() => setConfigOpen(true)}>
                <Settings2 /> Configure
              </Button>
              <Button size="xs" variant="ghost" className="ml-auto text-critical hover:text-critical" disabled={pending} onClick={() => setConfirmDisconnect(true)}>
                <Unplug /> Disconnect
              </Button>
            </>
          ) : (
            <>
              <Button size="xs" variant="accent" disabled={pending} onClick={() => run(() => connectIntegrationAction(it.key), () => `${it.name} connected.`)}>
                <Plug /> Connect
              </Button>
              <Button size="xs" variant="outline" disabled title="Connect first">
                <RefreshCw /> Sync now
              </Button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={`Disconnect ${it.name}?`}
        description={`Health data from this source (${it.feeds.length ? it.feeds.join(", ") : "this connector"}) stops refreshing. Existing scores are kept until the next recalculation.`}
        confirmLabel="Disconnect"
        tone="destructive"
        loading={pending}
        onConfirm={() => run(() => disconnectIntegrationAction(it.key), () => `${it.name} disconnected.`, () => setConfirmDisconnect(false))}
      />
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {it.name}</DialogTitle>
            <DialogDescription>Credentials are managed outside this screen; only the sync schedule is configurable here.</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor={`freq-${it.key}`} className="mb-1.5 block text-xs font-semibold text-foreground-muted">
              Sync frequency
            </label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
              <SelectTrigger id={`freq-${it.key}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() => run(() => configureIntegrationAction(it.key, { syncFrequency: frequency }), () => `${it.name} now syncs ${frequency}.`, () => setConfigOpen(false))}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
