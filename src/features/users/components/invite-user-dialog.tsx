"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { inviteUserAction } from "../actions";
import { InviteLink } from "./invite-link";
import { inviteFormSchema, type InviteFormValues } from "./schemas";
import { SegmentCheckboxes } from "./segment-checkboxes";

export function InviteUserDialog({ assignableRoles }: { assignableRoles: readonly RoleKey[] }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const defaultRole = assignableRoles.includes("csm") ? "csm" : (assignableRoles[0] ?? "viewer");
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { name: "", email: "", role: defaultRole, title: "", segments: [] },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await inviteUserAction(values);
    if (!result.ok) {
      for (const [key, msgs] of Object.entries(result.fieldErrors ?? {})) {
        if (key in values) form.setError(key as keyof InviteFormValues, { message: msgs[0] });
      }
      setFormError(result.error);
      return;
    }
    setToken(result.data.inviteToken);
    toast.success(`Invitation created for ${values.name}.`);
  });

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setToken(null);
      setFormError(null);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <Button variant="default" onClick={() => setOpen(true)} disabled={assignableRoles.length === 0}>
        <UserPlus /> Invite user
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{token ? "Invitation ready" : "Invite a teammate"}</DialogTitle>
          <DialogDescription>{token ? "They'll set their name and password when they open the link." : "They'll join this workspace with the role and access you choose."}</DialogDescription>
        </DialogHeader>
        {token ? (
          <>
            <InviteLink token={token} />
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <FormError message={formError} />
            <Field id="invite-name" label="Full name" error={errors.name?.message} required>
              <Input id="invite-name" autoComplete="off" aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("invite-name", errors.name?.message)} {...form.register("name")} />
            </Field>
            <Field id="invite-email" label="Work email" error={errors.email?.message} required>
              <Input id="invite-email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("invite-email", errors.email?.message)} {...form.register("email")} />
            </Field>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Field id="invite-role" label="Role" error={errors.role?.message} required>
                <Controller
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="invite-role" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field id="invite-title" label="Title" error={errors.title?.message}>
                <Input id="invite-title" placeholder="e.g. Digital CSM" {...form.register("title")} />
              </Field>
            </div>
            <Controller control={form.control} name="segments" render={({ field }) => <SegmentCheckboxes idPrefix="invite-seg" value={field.value} onChange={field.onChange} />} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Create invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
