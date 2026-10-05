"use client";

import { MousePointerClick, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { EMAIL_TEMPLATES, getEmailTemplate } from "@/config/email-templates";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STEP_TYPE_LABELS } from "@/features/agents/domain/steps";
import type { AgentStepConfig, AgentStepNode, ConditionStepConfig } from "@/features/agents/domain/types";
import { AUDIENCE_FIELDS, getAudienceField, OPERATOR_LABELS, operatorsForField } from "@/features/audiences/domain/fields";
import type { AudienceFieldKey, AudienceOperator } from "@/features/audiences/domain/types";
import { StepIcon } from "./step-style";

interface StepConfigPanelProps {
  step: AgentStepNode | null;
  readOnly: boolean;
  onChange: (config: AgentStepConfig) => void;
  onRemove: () => void;
}

const AUTO_FIELDS = AUDIENCE_FIELDS.filter((f) => f.key !== "owner");
const num = (v: string, fallback: number) => (v.trim() === "" || !Number.isFinite(Number(v)) ? fallback : Number(v));

function SelectField<T extends string>({ id, label, value, options, onChange, disabled }: { id: string; label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; disabled: boolean }) {
  return (
    <Field id={id} label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ConditionFields({ config, readOnly, onChange }: { config: ConditionStepConfig; readOnly: boolean; onChange: (c: ConditionStepConfig) => void }) {
  const field = config.field ? getAudienceField(config.field) : null;
  const operators = config.field ? operatorsForField(config.field) : [];
  const multi = config.operator === "in" || config.operator === "notIn";
  const setField = (key: AudienceFieldKey) => {
    const def = getAudienceField(key);
    const op = operatorsForField(key)[0];
    onChange({ ...config, field: key, operator: op, value: def.type === "enum" ? (def.options?.[0]?.value ?? "") : 60 });
  };
  const setOperator = (op: AudienceOperator) => {
    const nextMulti = op === "in" || op === "notIn";
    let value = config.value;
    if (nextMulti && !Array.isArray(value)) value = value === undefined || value === "" ? [] : [String(value)];
    if (!nextMulti && Array.isArray(value)) value = value[0] ?? "";
    onChange({ ...config, operator: op, value });
  };

  return (
    <>
      <SelectField
        id="cf-mode"
        label="How is it decided?"
        value={config.mode}
        disabled={readOnly}
        options={[
          { value: "manual", label: "A person decides (appears in My Work)" },
          { value: "auto", label: "Automatically from account data" },
        ]}
        onChange={(mode) => onChange(mode === "auto" ? { ...config, mode, field: config.field ?? "healthScore", operator: config.operator ?? "lessThan", value: config.value ?? 60 } : { ...config, mode })}
      />
      <Field id="cf-label" label={config.mode === "manual" ? "Question for the owner" : "Description"} hint={config.mode === "manual" ? "Phrase it as a yes/no question." : undefined}>
        <Input id="cf-label" value={config.label} disabled={readOnly} maxLength={200} onChange={(e) => onChange({ ...config, label: e.target.value })} />
      </Field>
      {config.mode === "auto" && (
        <>
          <SelectField id="cf-field" label="Field" value={config.field ?? "healthScore"} disabled={readOnly} options={AUTO_FIELDS.map((f) => ({ value: f.key, label: f.label }))} onChange={setField} />
          {field && (
            <SelectField id="cf-op" label="Operator" value={config.operator ?? operators[0]} disabled={readOnly} options={operators.map((o) => ({ value: o, label: OPERATOR_LABELS[o] }))} onChange={setOperator} />
          )}
          {field?.type === "number" && (
            <Field id="cf-value" label="Value">
              <Input id="cf-value" type="number" inputMode="numeric" disabled={readOnly} value={typeof config.value === "number" || typeof config.value === "string" ? config.value : ""} onChange={(e) => onChange({ ...config, value: e.target.value === "" ? "" : Number(e.target.value) })} />
            </Field>
          )}
          {field?.type === "enum" && !multi && (
            <SelectField id="cf-value" label="Value" value={String(config.value ?? "")} disabled={readOnly} options={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => onChange({ ...config, value: v })} />
          )}
          {field?.type === "enum" && multi && (
            <fieldset className="mb-3.5">
              <legend className="mb-1.5 text-xs font-semibold text-foreground-muted">Values</legend>
              <div className="flex flex-col gap-1.5">
                {(field.options ?? []).map((o) => {
                  const values = Array.isArray(config.value) ? config.value : [];
                  return (
                    <label key={o.value} className="flex items-center gap-2 text-[12.5px]">
                      <Checkbox
                        checked={values.includes(o.value)}
                        disabled={readOnly}
                        onCheckedChange={(c) => onChange({ ...config, value: c ? [...values, o.value] : values.filter((v) => v !== o.value) })}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <p className="-mt-1 mb-3 text-[11.5px] text-foreground-faint">Evaluated automatically against the account when the run reaches this step.</p>
        </>
      )}
      <p className="mb-3 text-[11.5px] text-foreground-faint">Build the Yes and No branches on the canvas with their own “Add step” buttons.</p>
    </>
  );
}

export function StepConfigPanel({ step, readOnly, onChange, onRemove }: StepConfigPanelProps) {
  if (!step) {
    return (
      <div className="flex flex-col items-center px-3 py-10 text-center text-[13px] text-foreground-faint">
        <MousePointerClick className="mb-2 size-6 stroke-[1.5]" aria-hidden />
        Select a step on the canvas to configure it, or use “Add step” to insert a new one.
      </div>
    );
  }

  let fields: ReactNode = null;
  switch (step.type) {
    case "email": {
      const c = step.config;
      const tpl = getEmailTemplate(c.templateKey);
      fields = (
        <>
          <SelectField id="cf-template" label="Email template" value={c.templateKey} disabled={readOnly} options={EMAIL_TEMPLATES.map((t) => ({ value: t.key, label: t.name }))} onChange={(templateKey) => onChange({ ...c, templateKey })} />
          <label className="mb-3.5 flex items-start gap-2 text-xs">
            <Checkbox className="mt-0.5" checked={c.requiresApproval} disabled={readOnly} onCheckedChange={(v) => onChange({ ...c, requiresApproval: v === true })} />
            <span>
              <b>Require manager approval</b> before this email sends — it waits in My Work as a pending approval instead of sending automatically.
            </span>
          </label>
          {tpl && (
            <div className="rounded-md border border-border bg-surface-muted p-3 text-xs">
              <div className="text-label mb-1">Subject</div>
              <p className="mb-2 text-foreground-muted">{tpl.subject}</p>
              <div className="text-label mb-1">Body preview</div>
              <p className="max-h-40 overflow-y-auto whitespace-pre-line text-foreground-muted">{tpl.body}</p>
            </div>
          )}
        </>
      );
      break;
    }
    case "task": {
      const c = step.config;
      fields = (
        <>
          <Field id="cf-title" label="Task description" required>
            <Input id="cf-title" value={c.title} disabled={readOnly} maxLength={200} onChange={(e) => onChange({ ...c, title: e.target.value })} aria-invalid={!c.title.trim() || undefined} />
          </Field>
          <Field id="cf-owner" label="Owner role" hint="Assigned to the account's owner; the role is shown for context.">
            <Input id="cf-owner" value={c.ownerRole} disabled={readOnly} maxLength={40} onChange={(e) => onChange({ ...c, ownerRole: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="cf-due" label="Due in (days)">
              <Input id="cf-due" type="number" min={0} max={365} disabled={readOnly} value={c.dueInDays} onChange={(e) => onChange({ ...c, dueInDays: Math.max(0, Math.round(num(e.target.value, 0))) })} />
            </Field>
            <SelectField id="cf-priority" label="Priority" value={c.priority} disabled={readOnly} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} onChange={(priority) => onChange({ ...c, priority })} />
          </div>
        </>
      );
      break;
    }
    case "wait": {
      const c = step.config;
      fields = (
        <div className="grid grid-cols-2 gap-3">
          <Field id="cf-duration" label="Duration">
            <Input id="cf-duration" type="number" min={1} max={365} disabled={readOnly} value={c.duration} onChange={(e) => onChange({ ...c, duration: num(e.target.value, 0) })} aria-invalid={c.duration <= 0 || undefined} />
          </Field>
          <SelectField id="cf-unit" label="Unit" value={c.unit} disabled={readOnly} options={[{ value: "days", label: "Days" }, { value: "hours", label: "Hours" }]} onChange={(unit) => onChange({ ...c, unit })} />
        </div>
      );
      break;
    }
    case "condition":
      fields = <ConditionFields config={step.config} readOnly={readOnly} onChange={onChange} />;
      break;
    case "api": {
      const c = step.config;
      fields = (
        <>
          <SelectField id="cf-method" label="Method" value={c.method} disabled={readOnly} options={(["GET", "POST", "PUT", "PATCH"] as const).map((m) => ({ value: m, label: m }))} onChange={(method) => onChange({ ...c, method })} />
          <Field id="cf-endpoint" label="Endpoint" hint="A relative path, e.g. /v1/accounts/{id}/escalate">
            <Input id="cf-endpoint" value={c.endpoint} disabled={readOnly} maxLength={300} className="font-mono" onChange={(e) => onChange({ ...c, endpoint: e.target.value })} aria-invalid={!c.endpoint.startsWith("/") || undefined} />
          </Field>
          <Field id="cf-payload" label="Payload">
            <Textarea id="cf-payload" value={c.payload} disabled={readOnly} maxLength={4000} className="font-mono text-xs" onChange={(e) => onChange({ ...c, payload: e.target.value })} />
          </Field>
          <p className="mb-3 rounded-md bg-stable-tint px-2.5 py-2 text-[11.5px] text-stable">Outbound webhooks aren&apos;t configured in this environment — requests are logged on the run, not sent.</p>
        </>
      );
      break;
    }
    case "approval": {
      const c = step.config;
      fields = (
        <>
          <Field id="cf-atitle" label="What needs approval" required>
            <Input id="cf-atitle" value={c.title} disabled={readOnly} maxLength={200} onChange={(e) => onChange({ ...c, title: e.target.value })} />
          </Field>
          <Field id="cf-approver" label="Approver role">
            <Input id="cf-approver" value={c.approverRole} disabled={readOnly} maxLength={60} onChange={(e) => onChange({ ...c, approverRole: e.target.value })} />
          </Field>
        </>
      );
      break;
    }
    case "stop": {
      const c = step.config;
      fields = (
        <Field id="cf-reason" label="Reason (optional)" hint="Remaining steps are skipped and the run completes.">
          <Input id="cf-reason" value={c.reason} disabled={readOnly} maxLength={200} onChange={(e) => onChange({ ...c, reason: e.target.value })} />
        </Field>
      );
      break;
    }
  }

  return (
    <div>
      <h3 className="mb-3.5 flex items-center gap-2 text-[13.5px] font-semibold">
        <StepIcon type={step.type} size="sm" /> {STEP_TYPE_LABELS[step.type]} step
      </h3>
      {fields}
      {!readOnly && (
        <Button variant="destructive" size="sm" className="mt-1" onClick={onRemove}>
          <Trash2 /> Remove step
        </Button>
      )}
    </div>
  );
}
