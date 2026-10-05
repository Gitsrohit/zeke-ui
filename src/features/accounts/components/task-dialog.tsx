"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAccountTaskAction } from "../actions";
import { taskClientSchema, type TaskFormValues } from "./schemas";

export type TaskDialogMode = "task" | "email" | "meeting";

const COPY: Record<TaskDialogMode, { title: string; description: string; submit: string; success: string }> = {
  task: { title: "Create task", description: "Adds a task to the owner's My Work queue.", submit: "Create task", success: "Task created and added to My Work." },
  email: { title: "Send email", description: "Draft the email to send from Outlook 365.", submit: "Queue email", success: "Email queued in My Work and logged on the timeline." },
  meeting: { title: "Schedule meeting", description: "Plan a meeting with the account's stakeholders.", submit: "Schedule", success: "Meeting request added to My Work." },
};

const TYPES = [
  { value: "task", label: "Task" },
  { value: "call", label: "Call / meeting" },
  { value: "email", label: "Email" },
  { value: "follow_up", label: "Follow-up" },
  { value: "review", label: "Review" },
] as const;

export function TaskDialog({ open, onOpenChange, accountId, accountName, mode }: { open: boolean; onOpenChange: (o: boolean) => void; accountId: string; accountName: string; mode: TaskDialogMode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const copy = COPY[mode];
  const defaults: TaskFormValues =
    mode === "email"
      ? { title: `Email ${accountName}: `, type: "email", priority: "medium", dueInDays: 0, description: "" }
      : mode === "meeting"
        ? { title: `Meeting with ${accountName}`, type: "call", priority: "medium", dueInDays: 3, description: "" }
        : { title: "", type: "task", priority: "medium", dueInDays: 2, description: "" };
  const { register, control, handleSubmit, formState, reset } = useForm<TaskFormValues>({ resolver: zodResolver(taskClientSchema), defaultValues: defaults });
  const { errors } = formState;

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setFormError(null);
      const result = await createAccountTaskAction(accountId, { ...values, description: values.description || undefined });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(copy.success);
      reset(defaults);
      onOpenChange(false);
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.description} Account: <b className="text-foreground">{accountName}</b>
          </DialogDescription>
        </DialogHeader>
        {mode !== "task" && (
          <p className="flex gap-2 rounded-md bg-violet-tint px-3 py-2 text-xs text-violet-deep">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Outlook 365 delivery runs in demo mode — this is logged to My Work and the timeline rather than sent.
          </p>
        )}
        <form onSubmit={onSubmit} noValidate>
          <FormError message={formError} />
          <Field id="task-title" label={mode === "email" ? "Subject" : "Title"} error={errors.title?.message} required>
            <Input id="task-title" autoFocus aria-invalid={Boolean(errors.title)} aria-describedby={describedBy("task-title", errors.title?.message)} {...register("title")} />
          </Field>
          <div className="grid gap-x-3 sm:grid-cols-3">
            <Field id="task-type" label="Type">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="task-priority" label="Priority">
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="task-due" label="Due in (days)" error={errors.dueInDays?.message}>
              <Input id="task-due" type="number" min={0} max={365} inputMode="numeric" aria-invalid={Boolean(errors.dueInDays)} {...register("dueInDays")} />
            </Field>
          </div>
          <Field id="task-desc" label={mode === "email" ? "Message" : "Notes"} error={errors.description?.message}>
            <Textarea id="task-desc" rows={mode === "email" ? 6 : 3} {...register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={pending}>
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
