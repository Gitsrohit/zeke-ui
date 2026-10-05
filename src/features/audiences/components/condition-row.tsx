"use client";

import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIENCE_FIELDS, getAudienceField, OPERATOR_LABELS, operatorsForField, type FieldOption } from "@/features/audiences/domain/fields";
import type { AudienceCondition, AudienceFieldKey, AudienceOperator } from "@/features/audiences/domain/types";
import { cn } from "@/lib/utils";
import type { FilterAction } from "./filter-reducer";
import type { OwnerOption } from "./types";

interface ConditionRowProps {
  condition: AudienceCondition;
  owners: OwnerOption[];
  error?: string;
  dispatch: (action: FilterAction) => void;
  disabled?: boolean;
}

function MultiValuePicker({ options, value, onChange, label, disabled }: { options: readonly FieldOption[]; value: string[]; onChange: (v: string[]) => void; label: string; disabled?: boolean }) {
  const summary = value.length === 0 ? "Choose values…" : options.filter((o) => value.includes(o.value)).map((o) => o.label).join(", ");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 w-full justify-between font-normal" aria-label={label} disabled={disabled}>
          <span className={cn("truncate", value.length === 0 && "text-foreground-faint")}>{summary}</span>
          <ChevronDown className="text-foreground-faint" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5">
        <ul className="max-h-64 overflow-y-auto">
          {options.map((o) => {
            const checked = value.includes(o.value);
            const id = `opt-${label}-${o.value}`.replace(/\W+/g, "-");
            return (
              <li key={o.value}>
                <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-surface-muted">
                  <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true ? [...value, o.value] : value.filter((x) => x !== o.value))} />
                  {o.label}
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function ConditionRow({ condition, owners, error, dispatch, disabled }: ConditionRowProps) {
  const field = getAudienceField(condition.field);
  const ownerIds = owners.map((o) => o.id);
  const options: readonly FieldOption[] = condition.field === "owner" ? owners.map((o) => ({ value: o.id, label: o.name })) : (field.options ?? []);
  const multi = condition.operator === "in" || condition.operator === "notIn";
  const errorId = `${condition.id}-error`;

  return (
    <div className="mb-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={condition.field} onValueChange={(v) => dispatch({ type: "changeField", conditionId: condition.id, field: v as AudienceFieldKey, ownerIds })} disabled={disabled}>
          <SelectTrigger className="h-8 w-full sm:w-[200px]" aria-label="Field">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_FIELDS.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={condition.operator} onValueChange={(v) => dispatch({ type: "changeOperator", conditionId: condition.id, operator: v as AudienceOperator })} disabled={disabled}>
          <SelectTrigger className="h-8 w-full sm:w-[140px]" aria-label="Operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operatorsForField(condition.field).map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="min-w-0 flex-1">
          {field.type === "enum" ? (
            multi ? (
              <MultiValuePicker
                label={`${field.label} values`}
                options={options}
                value={Array.isArray(condition.value) ? condition.value : []}
                onChange={(v) => dispatch({ type: "changeValue", conditionId: condition.id, value: v })}
                disabled={disabled}
              />
            ) : (
              <Select value={String(condition.value)} onValueChange={(v) => dispatch({ type: "changeValue", conditionId: condition.id, value: v })} disabled={disabled}>
                <SelectTrigger className="h-8 w-full" aria-label={`${field.label} value`} aria-invalid={Boolean(error) || undefined}>
                  <SelectValue placeholder="Choose a value" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : (
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                value={Array.isArray(condition.value) ? "" : String(condition.value)}
                onChange={(e) => dispatch({ type: "changeValue", conditionId: condition.id, value: e.target.value === "" ? "" : Number(e.target.value) })}
                aria-label={`${field.label} value`}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(field.unit && "pr-12")}
                disabled={disabled}
              />
              {field.unit && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-[11px] text-foreground-faint">{field.unit}</span>}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" className="self-end text-foreground-faint hover:text-critical sm:self-auto" onClick={() => dispatch({ type: "removeCondition", conditionId: condition.id })} aria-label={`Remove condition ${field.label}`} disabled={disabled}>
          <X />
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-[11.5px] text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
