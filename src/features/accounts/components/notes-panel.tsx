"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquare } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/utils/format";
import { addNoteAction } from "../actions";
import { noteClientSchema } from "./schemas";

interface NoteView {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  pending?: boolean;
}

export function NotesPanel({ accountId, notes, canWrite, currentUserName }: { accountId: string; notes: NoteView[]; canWrite: boolean; currentUserName: string }) {
  const [optimistic, addOptimistic] = useOptimistic(notes, (state: NoteView[], note: NoteView) => [note, ...state]);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, reset, formState } = useForm<{ body: string }>({ resolver: zodResolver(noteClientSchema), defaultValues: { body: "" } });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      addOptimistic({ id: `pending-${Date.now()}`, body: values.body.trim(), createdAt: new Date().toISOString(), authorName: currentUserName, pending: true });
      reset();
      const result = await addNoteAction(accountId, values);
      if (result.ok) toast.success("Note added.");
      else toast.error(result.error);
    }),
  );

  return (
    <div className="max-w-3xl">
      {canWrite && (
        <form onSubmit={onSubmit} className="mb-5 rounded-lg border border-border bg-surface p-3" noValidate>
          <label htmlFor="new-note" className="mb-1.5 block text-xs font-semibold text-foreground-muted">
            Add a note for the team
          </label>
          <Textarea id="new-note" rows={3} placeholder="Leave context for the next person who opens this account…" aria-invalid={Boolean(formState.errors.body)} {...register("body")} />
          {formState.errors.body && (
            <p role="alert" className="mt-1 text-[11.5px] text-critical">
              {formState.errors.body.message}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" variant="accent" loading={pending}>
              Add note
            </Button>
          </div>
        </form>
      )}
      {optimistic.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No notes yet" description="Leave context for the next person who opens this account." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {optimistic.map((n) => (
            <li key={n.id} className="px-4 py-3" aria-busy={n.pending || undefined}>
              <div className="flex justify-between gap-3">
                <span className="text-[12.5px] font-semibold">{n.authorName ?? "Former teammate"}</span>
                <span className="font-mono text-[11px] text-foreground-faint">{n.pending ? "saving…" : formatRelativeTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 text-[13px] whitespace-pre-line text-foreground-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
