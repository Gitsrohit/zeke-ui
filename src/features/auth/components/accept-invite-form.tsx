"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptInviteAction } from "../actions";
import { acceptInviteSchema, type AcceptInviteInput } from "../schemas";

export function AcceptInviteForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState } = useForm<AcceptInviteInput>({ resolver: zodResolver(acceptInviteSchema), defaultValues: { token, name: defaultName, password: "" } });
  const hint = "At least 10 characters, with a letter and a number.";

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setFormError(null);
      const result = await acceptInviteAction(values);
      if (result.ok) {
        router.push(result.data.redirectTo);
        router.refresh();
      } else setFormError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormError message={formError} />
      <input type="hidden" {...register("token")} />
      <Field id="name" label="Full name" error={formState.errors.name?.message}>
        <Input id="name" autoComplete="name" aria-invalid={Boolean(formState.errors.name)} aria-describedby={describedBy("name", formState.errors.name?.message)} {...register("name")} />
      </Field>
      <Field id="password" label="Choose a password" error={formState.errors.password?.message} hint={hint}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(formState.errors.password)} aria-describedby={describedBy("password", formState.errors.password?.message, hint)} {...register("password")} />
      </Field>
      <Button type="submit" size="lg" className="mt-1 w-full" loading={pending}>
        Join workspace
      </Button>
    </form>
  );
}
