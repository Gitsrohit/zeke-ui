"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Lock, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { updateScorecardSchema } from "@/features/scorecards/schemas";
import { DEFAULT_BAND_THRESHOLDS, DEFAULT_WEIGHTS, HEALTH_BANDS, HEALTH_SOURCE_KEYS, HEALTH_SOURCES, type BandThresholds, type HealthBandKey, type LifecycleStageName, type SourceWeights } from "@/config/health";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { BAND_STYLES } from "@/components/shared/band-styles";
import { Card } from "@/components/shared/card";
import { HealthBadge } from "@/components/shared/health-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { getHealthBand, validateBandThresholds, validateWeights } from "@/features/health/domain/score";
import { cn } from "@/lib/utils";
import { updateScorecardAction } from "../actions";

/** Derived from the canonical updateScorecardSchema; numeric inputs are already numbers in the form. */
const formSchema = updateScorecardSchema.extend({
  weights: z.object(Object.fromEntries(HEALTH_SOURCE_KEYS.map((k) => [k, z.number().int().min(0, "Min 0").max(100, "Max 100")])) as Record<(typeof HEALTH_SOURCE_KEYS)[number], z.ZodNumber>),
  thresholds: z.object({ thriving: z.number().int(), stable: z.number().int(), atRisk: z.number().int() }),
});
type FormValues = z.infer<typeof formSchema>;

interface ScorecardEditorProps {
  scorecardId: string;
  lifecycle: string;
  weights: SourceWeights;
  thresholds: BandThresholds;
  canManage: boolean;
  accounts: Array<{ id: string; name: string; score: number; band: HealthBandKey }>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ScorecardEditor({ scorecardId, lifecycle, weights, thresholds, canManage, accounts }: ScorecardEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { weights: { ...weights }, thresholds: { ...thresholds }, effectiveFrom: today(), changeNote: "" },
    mode: "onChange",
  });
  const { control, register, handleSubmit, setValue, formState, setError, reset } = form;
  const watchedWeights = useWatch({ control, name: "weights" }) as SourceWeights;
  const watchedThresholds = useWatch({ control, name: "thresholds" }) as BandThresholds;
  const weightCheck = validateWeights(watchedWeights);
  const bandCheck = validateBandThresholds(watchedThresholds);
  const thresholdsChanged = (["thriving", "stable", "atRisk"] as const).some((k) => watchedThresholds[k] !== thresholds[k]);
  const bandChanges = bandCheck.valid ? accounts.filter((a) => getHealthBand(a.score, watchedThresholds) !== a.band) : [];
  const disabled = !canManage || pending;
  const defaults = DEFAULT_WEIGHTS[lifecycle as LifecycleStageName];

  const onSubmit = (values: FormValues) => {
    if (!weightCheck.valid || !bandCheck.valid) return;
    startTransition(async () => {
      const result = await updateScorecardAction(scorecardId, { ...values, changeNote: values.changeNote || undefined });
      if (!result.ok) {
        setError("root", { message: result.error });
        toast.error(result.error);
        return;
      }
      const { version, scoresChanged, bandChanges: changedBands } = result.data;
      toast.success(`v${version} saved — ${scoresChanged} score${scoresChanged === 1 ? "" : "s"} changed, ${changedBands} band change${changedBands === 1 ? "" : "s"}.`);
      reset({ ...values, changeNote: "" });
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {!canManage && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-[12.5px] text-foreground-muted xl:col-span-2">
          <Lock className="size-4 shrink-0" aria-hidden /> You can view this scorecard. Changing weights or bands requires the <code className="font-mono text-[11.5px]">scorecards.manage</code> permission.
        </div>
      )}
      <FormError message={formState.errors.root?.message} />

      <Card className="px-5 py-4">
        <fieldset disabled={disabled}>
          <legend className="mb-2 text-[14.5px] font-semibold">Data source weighting</legend>
          {HEALTH_SOURCES.map((s) => {
            const id = `weight-${s.key}`;
            const error = formState.errors.weights?.[s.key]?.message;
            return (
              <div key={s.key} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-x-4 gap-y-1.5 border-b border-border py-2.5 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)_64px]">
                <div className="min-w-0">
                  <label htmlFor={id} className="block text-[13px] font-medium">
                    {s.name}
                  </label>
                  <div className="text-[11px] text-foreground-faint">{s.description}</div>
                </div>
                <Controller
                  control={control}
                  name={`weights.${s.key}`}
                  render={({ field }) => (
                    <Slider
                      className="order-3 col-span-2 sm:order-none sm:col-span-1"
                      min={0}
                      max={60}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                      aria-label={`${s.name} weight`}
                      disabled={disabled}
                    />
                  )}
                />
                <div className="flex items-center gap-1">
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    className="h-7 px-1.5 text-right font-mono"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(id, error)}
                    {...register(`weights.${s.key}`, { valueAsNumber: true })}
                  />
                  <span className="font-mono text-xs text-foreground-faint">%</span>
                </div>
              </div>
            );
          })}
          <div
            role="status"
            aria-live="polite"
            className={cn("mt-2 flex items-center justify-between border-t border-dashed border-border-strong pt-3 font-mono text-[13px]", weightCheck.total === 100 ? "text-thriving" : "text-critical")}
          >
            <span>Total weight</span>
            <span className="flex items-center gap-1 font-semibold">
              {weightCheck.total === 100 ? (
                <>
                  100% <Check className="size-4" aria-hidden /> <span className="sr-only">valid</span>
                </>
              ) : (
                `Total must equal 100% (currently ${weightCheck.total}%)`
              )}
            </span>
          </div>
          {canManage && (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => HEALTH_SOURCE_KEYS.forEach((k) => setValue(`weights.${k}`, defaults[k], { shouldDirty: true, shouldValidate: true }))}>
              <RotateCcw /> Reset to {lifecycle} default
            </Button>
          )}
        </fieldset>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="px-5 py-4">
          <fieldset disabled={disabled}>
            <legend className="mb-1 text-[14.5px] font-semibold">Health bands</legend>
            <p className="mb-3 text-[11.5px] text-foreground-faint">Minimum score for each band on this scorecard.</p>
            <div className="flex flex-col gap-1.5">
              {(["thriving", "stable", "atRisk"] as const).map((k) => (
                <div key={k} className={cn("flex items-center justify-between rounded-md px-3 py-2", BAND_STYLES[k].tint)}>
                  <HealthBadge band={k} />
                  <label className={cn("flex items-center gap-1.5 text-xs", BAND_STYLES[k].text)}>
                    min score
                    <Input type="number" min={1} max={99} className="h-7 w-16 px-1.5 text-right font-mono" aria-label={`${HEALTH_BANDS[k].label} minimum score`} {...register(`thresholds.${k}`, { valueAsNumber: true })} />
                  </label>
                </div>
              ))}
              <div className={cn("flex items-center justify-between rounded-md px-3 py-2", BAND_STYLES.critical.tint)}>
                <HealthBadge band="critical" />
                <span className={cn("font-mono text-xs", BAND_STYLES.critical.text)}>0 – {Math.max(0, (watchedThresholds.atRisk || 0) - 1)} (fixed floor)</span>
              </div>
            </div>
            {!bandCheck.valid && (
              <p role="alert" className="mt-2 font-mono text-[11.5px] text-critical">
                {bandCheck.errors[0]}
              </p>
            )}
            {canManage && (
              <Button type="button" variant="ghost" size="xs" className="mt-2" onClick={() => (["thriving", "stable", "atRisk"] as const).forEach((k) => setValue(`thresholds.${k}`, DEFAULT_BAND_THRESHOLDS[k], { shouldDirty: true }))}>
                <RotateCcw /> Default bands (80 / 60 / 40)
              </Button>
            )}
          </fieldset>
          {thresholdsChanged && bandCheck.valid && (
            <div className="mt-3 rounded-md border border-border bg-surface-muted p-3 text-[12px]" aria-live="polite">
              <p className="font-semibold">
                {bandChanges.length} account{bandChanges.length === 1 ? "" : "s"} would change band
              </p>
              <p className="text-[11px] text-foreground-faint">Preview applies the new thresholds to current scores. Weight changes are applied when you save.</p>
              {bandChanges.length > 0 && (
                <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
                  {bandChanges.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span className="truncate">{a.name}</span>
                      <span className="shrink-0 font-mono text-foreground-muted">
                        {HEALTH_BANDS[a.band].label} → {HEALTH_BANDS[getHealthBand(a.score, watchedThresholds)].label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card className="px-5 py-4">
          <fieldset disabled={disabled}>
            <legend className="mb-3 text-[14.5px] font-semibold">Publish as a new version</legend>
            <Field id="effectiveFrom" label="Effective from" error={formState.errors.effectiveFrom?.message} required>
              <Input id="effectiveFrom" type="date" aria-invalid={formState.errors.effectiveFrom ? true : undefined} aria-describedby={describedBy("effectiveFrom", formState.errors.effectiveFrom?.message)} {...register("effectiveFrom")} />
            </Field>
            <Field id="changeNote" label="Change note" hint="Shown in version history and the audit log." error={formState.errors.changeNote?.message}>
              <Textarea id="changeNote" rows={2} maxLength={300} placeholder="Why are you changing this scorecard?" aria-describedby={describedBy("changeNote", formState.errors.changeNote?.message, "hint")} {...register("changeNote")} />
            </Field>
          </fieldset>
          {canManage && (
            <Button type="submit" variant="accent" className="w-full" loading={pending} disabled={!weightCheck.valid || !bandCheck.valid || !formState.isDirty}>
              {!pending && <Save />} Save & recalculate
            </Button>
          )}
        </Card>
      </div>
    </form>
  );
}
