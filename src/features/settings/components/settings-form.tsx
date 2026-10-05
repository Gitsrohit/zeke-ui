"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { settingsSchema } from "@/features/settings/schemas";
import { FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { updateSettingsAction } from "../actions";

// Mirrors settingsSchema in settings.service.ts (server re-validates).
// Canonical rules from features/settings/schemas.ts; the slider yields numbers, so no coercion here.
const formSchema = settingsSchema.extend({ alertThreshold: z.number().int().min(0).max(100) });
type Values = z.infer<typeof formSchema>;

const SCHEDULES: Array<{ value: Values["recalculationSchedule"]; label: string; hint: string }> = [
  { value: "realtime", label: "Real-time (on new data)", hint: "Scores recalculate whenever a sync, scorecard change or account edit lands." },
  { value: "daily", label: "Daily at 6:00 AM", hint: "One recalculation per day for the whole workspace." },
  { value: "weekly", label: "Weekly on Mondays", hint: "Smoothest scores; slower to react to change." },
];

export function SettingsForm({ initial, canEdit }: { initial: Values; canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: initial });
  const { isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await updateSettingsAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Workspace settings saved.");
    form.reset(values);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-border bg-surface p-[18px]">
      <FormError message={error} />
      <fieldset disabled={!canEdit} className="grid gap-6 md:grid-cols-2">
        <div>
          <legend className="mb-2 text-[13px] font-semibold">Health score recalculation</legend>
          <Controller
            control={form.control}
            name="recalculationSchedule"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Health score recalculation" className="gap-2.5">
                {SCHEDULES.map((s) => (
                  <label key={s.value} htmlFor={`sched-${s.value}`} className="flex cursor-pointer items-start gap-2.5 text-[12.5px]">
                    <RadioGroupItem id={`sched-${s.value}`} value={s.value} className="mt-0.5" />
                    <span>
                      <span className="font-medium">{s.label}</span>
                      <span className="block text-[11.5px] text-foreground-faint">{s.hint}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
          <p className="mt-3 text-[11.5px] text-foreground-faint">
            Scheduled runs are triggered by the platform scheduler (the authenticated <code className="font-mono">/api/cron/*</code> endpoints) in production. In this environment, use Recalculate on the dashboard or a connector&apos;s Sync now to refresh scores.
          </p>
        </div>
        <div>
          <Controller
            control={form.control}
            name="alertThreshold"
            render={({ field }) => (
              <>
                <label htmlFor="alert-threshold" className="mb-2 block text-[13px] font-semibold">
                  Alert CSM when health score drops below
                </label>
                <Slider id="alert-threshold" min={0} max={100} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} aria-label="Alert threshold" />
                <p className="mt-2 font-mono text-xs text-foreground-muted">
                  Threshold: <b className="text-foreground">{field.value}</b>
                </p>
              </>
            )}
          />
          <p className="mt-2 text-[11.5px] text-foreground-faint">Owners are notified when one of their accounts crosses below this score after a recalculation.</p>
        </div>
      </fieldset>
      {canEdit ? (
        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" disabled={!isDirty || isSubmitting} onClick={() => form.reset(initial)}>
            Reset
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save settings
          </Button>
        </div>
      ) : (
        <p className="mt-5 border-t border-border pt-4 text-[12.5px] text-foreground-muted">
          Changing workspace settings requires <code className="font-mono text-[11.5px] text-foreground">settings.manage</code>.
        </p>
      )}
    </form>
  );
}
