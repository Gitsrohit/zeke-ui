"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, type RoleKey } from "@/lib/permissions";
import { updateMemberAction } from "../actions";
import { memberFormSchema, type MemberFormValues } from "./schemas";
import { SegmentCheckboxes } from "./segment-checkboxes";

export interface EditableMember {
  membershipId: string;
  name: string;
  role: RoleKey;
  title: string | null;
  segments: string[];
}

export function EditMemberDialog({ member, assignableRoles, isSelf, onOpenChange }: { member: EditableMember | null; assignableRoles: readonly RoleKey[]; isSelf: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent>{member && <EditMemberForm key={member.membershipId} member={member} assignableRoles={assignableRoles} isSelf={isSelf} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function EditMemberForm({ member, assignableRoles, isSelf, onDone }: { member: EditableMember; assignableRoles: readonly RoleKey[]; isSelf: boolean; onDone: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const roles = assignableRoles.includes(member.role) ? assignableRoles : [member.role, ...assignableRoles];
  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { role: member.role, title: member.title ?? "", segments: member.segments.filter((s): s is MemberFormValues["segments"][number] => ["Enterprise", "Mid-Market", "SMB"].includes(s)) },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await updateMemberAction(member.membershipId, values);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    toast.success(`${member.name} updated.`);
    onDone();
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit {member.name}</DialogTitle>
        <DialogDescription>Role changes sign them out so new permissions apply immediately.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} noValidate>
        <FormError message={formError} />
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field id="member-role" label="Role" error={errors.role?.message} hint={isSelf ? "You can't change your own role." : undefined}>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                  <SelectTrigger id="member-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r} disabled={!assignableRoles.includes(r)}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="member-title" label="Title" error={errors.title?.message}>
            <Input id="member-title" {...form.register("title")} />
          </Field>
        </div>
        <Controller control={form.control} name="segments" render={({ field }) => <SegmentCheckboxes idPrefix="member-seg" value={field.value} onChange={field.onChange} />} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
