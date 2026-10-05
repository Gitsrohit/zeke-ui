"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import { toast } from "sonner";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAccountAction, editAccountAction } from "../actions";
import type { AccountFilterOptions } from "./accounts-table";
import { accountFormClientSchema, type AccountFormValues } from "./schemas";

const NONE = "__none";

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: AccountFilterOptions;
  /** When set, the dialog edits this account. */
  account?: { id: string; values: AccountFormValues };
}

export function AccountFormDialog({ open, onOpenChange, options, account }: AccountFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const editing = Boolean(account);
  const { register, control, handleSubmit, setError, formState, reset } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormClientSchema),
    defaultValues: account?.values ?? {
      name: "",
      domain: "",
      industry: "",
      lifecycleStageId: options.lifecycles[0]?.id ?? "",
      segmentId: options.segments[0]?.id ?? "",
      ownerId: "",
      arr: 0,
      renewalDate: "",
      licensedSeats: "",
    },
  });
  const { errors } = formState;

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setFormError(null);
      const payload = {
        ...values,
        ownerId: values.ownerId || null,
        renewalDate: values.renewalDate || null,
        licensedSeats: values.licensedSeats === "" ? null : Number(values.licensedSeats),
      };
      const result = account ? await editAccountAction(account.id, payload) : await createAccountAction(payload);
      if (!result.ok) {
        for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (key in values) setError(key as Path<AccountFormValues>, { message: messages[0] });
        }
        setFormError(result.error);
        return;
      }
      toast.success(editing ? "Account updated." : "Account created.");
      onOpenChange(false);
      if (!editing) {
        reset();
        if (result.data && typeof result.data === "object" && "id" in result.data) router.push(`/accounts/${result.data.id}`);
      } else router.refresh();
    }),
  );

  const text = (name: Path<AccountFormValues>, label: string, props: React.ComponentProps<typeof Input> = {}, hint?: ReactNode) => {
    const error = errors[name]?.message;
    return (
      <Field id={`acct-${name}`} label={label} error={error} hint={hint} required={name === "name"}>
        <Input id={`acct-${name}`} aria-invalid={Boolean(error)} aria-describedby={describedBy(`acct-${name}`, error, hint)} {...props} {...register(name)} />
      </Field>
    );
  };

  const select = (name: "lifecycleStageId" | "segmentId" | "ownerId", label: string, items: Array<{ id: string; name: string }>, optional = false) => (
    <Field id={`acct-${name}`} label={label} error={errors[name]?.message} required={!optional}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value || (optional ? NONE : "")} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
            <SelectTrigger id={`acct-${name}`} className="w-full" aria-invalid={Boolean(errors[name])}>
              <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {optional && <SelectItem value={NONE}>Unassigned</SelectItem>}
              {items.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>{editing ? "Changing lifecycle or segment moves the account to a different scorecard and recalculates its health." : "The account is scored against the scorecard for its lifecycle stage and segment."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FormError message={formError} />
          {text("name", "Account name", { autoFocus: true })}
          <div className="grid gap-x-3 sm:grid-cols-2">
            {text("domain", "Domain", { placeholder: "acme.com" })}
            {text("industry", "Industry")}
            {select("lifecycleStageId", "Lifecycle stage", options.lifecycles)}
            {select("segmentId", "Segment", options.segments)}
            {text("arr", "ARR ($)", { type: "number", min: 0, step: 1000, inputMode: "numeric" })}
            {select("ownerId", "CSM owner", options.owners, true)}
            {text("renewalDate", "Renewal date", { type: "date" })}
            {text("licensedSeats", "Licensed seats", { type: "number", min: 0, inputMode: "numeric" })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {editing ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
