"use client";

import { GitMerge, Target, Zap } from "lucide-react";
import { HEALTH_SOURCES, LIFECYCLE_STAGES, type HealthSourceKey } from "@/config/health";
import { Card } from "@/components/shared/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgentTriggerType } from "@/features/agents/domain/types";
import { cn } from "@/lib/utils";

export interface BuilderMeta {
  triggerType: AgentTriggerType;
  triggerLabel: string;
  audienceId: string | null;
  targetMetric: HealthSourceKey;
  cooldownDays: string;
  maxAttempts: string;
  eligibleLifecycles: string[];
  conflictsWith: string[];
}

export const TRIGGER_DEFAULT_LABELS: Record<AgentTriggerType, string> = {
  manual: "Run manually from an audience",
  audience: "Runs when an account enters the attached audience",
  event: "Runs when the configured event fires",
};

interface BuilderSettingsProps {
  meta: BuilderMeta;
  readOnly: boolean;
  audiences: Array<{ id: string; name: string; memberCount: number }>;
  otherAgents: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<BuilderMeta>) => void;
}

const NONE = "__none";

export function BuilderSettings({ meta, readOnly, audiences, otherAgents, onChange }: BuilderSettingsProps) {
  const toggle = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value));
  const cooldownInvalid = meta.cooldownDays.trim() === "" || !Number.isInteger(Number(meta.cooldownDays)) || Number(meta.cooldownDays) < 0;
  const attemptsInvalid = meta.maxAttempts.trim() !== "" && (!Number.isInteger(Number(meta.maxAttempts)) || Number(meta.maxAttempts) < 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-[#ddd0f7] bg-primary-tint px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-[7px] bg-primary text-white">
            <Zap className="size-[15px]" />
          </span>
          <span className="text-[12.5px] font-bold text-primary">Trigger</span>
          <Select
            value={meta.triggerType}
            disabled={readOnly}
            onValueChange={(v) => {
              const type = v as AgentTriggerType;
              const wasDefault = Object.values(TRIGGER_DEFAULT_LABELS).includes(meta.triggerLabel);
              onChange({ triggerType: type, triggerLabel: wasDefault ? TRIGGER_DEFAULT_LABELS[type] : meta.triggerLabel });
            }}
          >
            <SelectTrigger size="sm" className="ml-auto" aria-label="Trigger type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="audience">Audience</SelectItem>
              <SelectItem value="event">Event</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label htmlFor="trigger-label" className="sr-only">
          Trigger description
        </label>
        <Input id="trigger-label" className="mt-2 bg-surface" value={meta.triggerLabel} maxLength={160} disabled={readOnly} onChange={(e) => onChange({ triggerLabel: e.target.value })} aria-invalid={meta.triggerLabel.trim().length < 2 || undefined} />
        {meta.triggerType === "event" && <p className="mt-1.5 text-[11.5px] text-[#5c4b7e]">Event triggers are recorded for documentation; launch the agent from an audience or account until an event source is connected.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-xs">
        <Target className="size-4 text-primary" aria-hidden />
        <label htmlFor="attached-audience">Attached audience</label>
        <Select value={meta.audienceId ?? NONE} disabled={readOnly} onValueChange={(v) => onChange({ audienceId: v === NONE ? null : v })}>
          <SelectTrigger id="attached-audience" size="sm" className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— None —</SelectItem>
            {audiences.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.memberCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-xs">
        <label htmlFor="target-metric">Health metric this agent should move</label>
        <Select value={meta.targetMetric} disabled={readOnly} onValueChange={(v) => onChange({ targetMetric: v as HealthSourceKey })}>
          <SelectTrigger id="target-metric" size="sm" className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEALTH_SOURCES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="px-3.5 py-3">
        <h3 className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <GitMerge className="size-4 text-primary" aria-hidden /> Orchestration rules
          <span className="font-normal text-foreground-faint">— keeps this agent from double-booking an account</span>
        </h3>
        <fieldset>
          <legend className="mb-1.5 text-[11.5px] text-foreground-muted">Don&apos;t enroll an account already active in:</legend>
          {otherAgents.length === 0 ? (
            <p className="text-[11.5px] text-foreground-faint">No other agents yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {otherAgents.map((a) => {
                const checked = meta.conflictsWith.includes(a.id);
                return (
                  <label key={a.id} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]", checked ? "border-violet bg-violet-tint text-violet-deep" : "border-border bg-surface-muted")}>
                    <Checkbox checked={checked} disabled={readOnly} onCheckedChange={(v) => onChange({ conflictsWith: toggle(meta.conflictsWith, a.id, v === true) })} />
                    {a.name}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <span className="text-foreground-muted">Cooldown after completion</span>
            <Input type="number" min={0} max={365} className="h-7 w-16 font-mono" value={meta.cooldownDays} disabled={readOnly} onChange={(e) => onChange({ cooldownDays: e.target.value })} aria-invalid={cooldownInvalid || undefined} />
            <span className="text-foreground-muted">days</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-foreground-muted">Max runs per account</span>
            <Input type="number" min={1} max={50} placeholder="∞" className="h-7 w-16 font-mono" value={meta.maxAttempts} disabled={readOnly} onChange={(e) => onChange({ maxAttempts: e.target.value })} aria-invalid={attemptsInvalid || undefined} />
          </label>
        </div>
        <fieldset className="mt-3">
          <legend className="mb-1.5 text-[11.5px] text-foreground-muted">Eligible lifecycle stages (none selected = all)</legend>
          <div className="flex flex-wrap gap-3">
            {LIFECYCLE_STAGES.map((l) => (
              <label key={l} className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={meta.eligibleLifecycles.includes(l)} disabled={readOnly} onCheckedChange={(v) => onChange({ eligibleLifecycles: toggle(meta.eligibleLifecycles, l, v === true) })} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
    </div>
  );
}
