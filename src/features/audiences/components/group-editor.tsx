"use client";

import { Layers, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AudienceGroup, Combinator } from "@/features/audiences/domain/types";
import { cn } from "@/lib/utils";
import { ConditionRow } from "./condition-row";
import { MAX_GROUP_DEPTH, type FilterAction } from "./filter-reducer";
import type { OwnerOption } from "./types";

export function CombinatorToggle({ value, onChange, labels, label, disabled }: { value: Combinator; onChange: (c: Combinator) => void; labels: Record<Combinator, string>; label: string; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-[7px] border border-border bg-surface">
      {(["and", "or"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          disabled={disabled}
          onClick={() => onChange(c)}
          className={cn("border-r border-border px-2.5 py-1 font-mono text-[11px] font-semibold last:border-r-0", value === c ? "bg-primary text-white" : "text-foreground-muted hover:bg-surface-muted")}
        >
          {labels[c]}
        </button>
      ))}
    </div>
  );
}

export function CombinatorDivider({ combinator }: { combinator: Combinator }) {
  return (
    <div className="my-2.5 flex items-center gap-2.5" aria-hidden>
      <span className="h-px flex-1 bg-border-strong" />
      <span className="rounded-full bg-primary-tint px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-primary">{combinator.toUpperCase()}</span>
      <span className="h-px flex-1 bg-border-strong" />
    </div>
  );
}

interface GroupEditorProps {
  group: AudienceGroup;
  depth: number;
  owners: OwnerOption[];
  errors: Record<string, string>;
  dispatch: (action: FilterAction) => void;
  canRemove: boolean;
  disabled?: boolean;
}

export function GroupEditor({ group, depth, owners, errors, dispatch, canRemove, disabled }: GroupEditorProps) {
  const ownerIds = owners.map((o) => o.id);
  const items = group.conditions.length + group.groups.length;
  return (
    <section className={cn("rounded-lg border border-border-strong px-3.5 py-3", depth % 2 === 1 ? "bg-surface-muted" : "bg-surface")} aria-label={`Condition group, level ${depth}`}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-foreground-faint">MATCH</span>
        <CombinatorToggle value={group.combinator} onChange={(c) => dispatch({ type: "setGroupCombinator", groupId: group.id, combinator: c })} labels={{ and: "ALL", or: "ANY" }} label="How conditions in this group combine" disabled={disabled} />
        <span className="font-mono text-[11px] font-semibold text-foreground-faint">OF THESE CONDITIONS</span>
        {canRemove && (
          <Button variant="ghost" size="icon-xs" className="ml-auto text-foreground-faint hover:text-critical" onClick={() => dispatch({ type: "removeGroup", groupId: group.id })} aria-label="Remove group" disabled={disabled}>
            <X />
          </Button>
        )}
      </div>
      {items === 0 && <p className="pb-2 text-[11.5px] text-foreground-faint">No conditions yet — an empty group matches every account.</p>}
      {group.conditions.map((c, i) => (
        <div key={c.id}>
          {i > 0 && <p className="mb-1 font-mono text-[10.5px] font-semibold text-foreground-faint">{group.combinator.toUpperCase()}</p>}
          <ConditionRow condition={c} owners={owners} error={errors[c.id]} dispatch={dispatch} disabled={disabled} />
        </div>
      ))}
      {group.groups.map((g) => (
        <div key={g.id} className="mt-1 mb-2">
          {(group.conditions.length > 0 || group.groups[0]?.id !== g.id) && <p className="mb-1 font-mono text-[10.5px] font-semibold text-foreground-faint">{group.combinator.toUpperCase()}</p>}
          <GroupEditor group={g} depth={depth + 1} owners={owners} errors={errors} dispatch={dispatch} canRemove disabled={disabled} />
        </div>
      ))}
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "addCondition", groupId: group.id, ownerIds })} disabled={disabled}>
          <Plus /> Add condition
        </Button>
        {depth < MAX_GROUP_DEPTH && (
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "addNestedGroup", groupId: group.id, ownerIds })} disabled={disabled}>
            <Layers /> Add nested group
          </Button>
        )}
      </div>
    </section>
  );
}
