"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AudienceFilter } from "@/features/audiences/domain/types";
import { saveAudienceSchema } from "@/features/audiences/schemas";
import { pluralize } from "@/lib/utils/format";
import { saveAudienceAction } from "../actions";

const formSchema = saveAudienceSchema.pick({ name: true, description: true }).extend({ live: z.boolean() });
type FormValues = z.infer<typeof formSchema>;

interface SaveAudienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: AudienceFilter;
  matchCount: number | null;
  audience?: { id: string; name: string; description: string | null; type: "dynamic" | "static" };
}

/** Mounted only while open, so every opening starts from a fresh form. */
export function SaveAudienceDialog(props: SaveAudienceDialogProps) {
  return props.open ? <SaveAudienceForm {...props} /> : null;
}

function SaveAudienceForm({ open, onOpenChange, filter, matchCount, audience }: SaveAudienceDialogProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: audience?.name ?? "", description: audience?.description ?? "", live: (audience?.type ?? "dynamic") === "dynamic" },
  });
  const { register, handleSubmit, control, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await saveAudienceAction({ name: values.name, description: values.description || undefined, type: values.live ? "dynamic" : "static", filter }, audience?.id);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success(`Audience saved — ${pluralize(result.data.memberCount, "account")} (${values.live ? "live" : "static snapshot"}).`);
    onOpenChange(false);
    if (!audience) router.push(`/audiences/${result.data.id}`);
    else router.refresh();
  });

  const count = matchCount ?? 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{audience ? "Save changes" : "Save audience"}</DialogTitle>
          <DialogDescription>{matchCount === null ? "Evaluating matches…" : `${pluralize(count, "account")} currently match this filter set.`}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FormError message={serverError} />
          <Field id="aud-name" label="Audience name" error={formState.errors.name?.message} required>
            <Input id="aud-name" placeholder="e.g. Adoption accounts below 60" aria-invalid={Boolean(formState.errors.name) || undefined} aria-describedby={describedBy("aud-name", formState.errors.name?.message)} {...register("name")} />
          </Field>
          <Field id="aud-desc" label="Description" error={formState.errors.description?.message} hint="Optional — what is this list for?">
            <Textarea id="aud-desc" rows={2} aria-describedby={describedBy("aud-desc", formState.errors.description?.message, "x")} {...register("description")} />
          </Field>
          <Controller
            control={control}
            name="live"
            render={({ field }) => (
              <label htmlFor="aud-live" className="mb-4 flex cursor-pointer items-start gap-2.5 text-[12.5px]">
                <Checkbox id="aud-live" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                <span>
                  <b>Keep this audience live</b> — it re-evaluates its conditions every time it&rsquo;s used. Uncheck to freeze it as today&rsquo;s exact list of {pluralize(count, "account")} (a static snapshot).
                </span>
              </label>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {!formState.isSubmitting && <Save />} Save audience
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
