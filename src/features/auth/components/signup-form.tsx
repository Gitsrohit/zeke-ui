"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, type Path } from "react-hook-form";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signupAction } from "../actions";
import { signupSchema, type SignupInput } from "../schemas";

const FIELDS: Array<{ name: Path<SignupInput>; label: string; type: string; autoComplete: string; hint?: string }> = [
  { name: "name", label: "Full name", type: "text", autoComplete: "name" },
  { name: "email", label: "Work email", type: "email", autoComplete: "email" },
  { name: "organizationName", label: "Company", type: "text", autoComplete: "organization" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters, with a letter and a number." },
];

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<SignupInput>({ resolver: zodResolver(signupSchema), defaultValues: { name: "", email: "", organizationName: "", password: "" } });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setFormError(null);
      const result = await signupAction(values);
      if (result.ok) {
        router.push(result.data.redirectTo);
        router.refresh();
        return;
      }
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (FIELDS.some((f) => f.name === key)) setError(key as Path<SignupInput>, { message: messages[0] });
      }
      setFormError(result.error);
    }),
  );

  return (
    <>
      <h1 className="text-xl font-bold">Create your workspace</h1>
      <p className="mt-1 mb-5 text-[13px] text-foreground-muted">You&apos;ll be the owner. Scorecards and the agent library are set up for you.</p>
      <FormError message={formError} />
      <form onSubmit={onSubmit} noValidate>
        {FIELDS.map((f) => {
          const error = formState.errors[f.name]?.message;
          return (
            <Field key={f.name} id={f.name} label={f.label} error={error} hint={f.hint}>
              <Input id={f.name} type={f.type} autoComplete={f.autoComplete} aria-invalid={Boolean(error)} aria-describedby={describedBy(f.name, error, f.hint)} {...register(f.name)} />
            </Field>
          );
        })}
        <Button type="submit" className="mt-1 w-full" size="lg" loading={pending}>
          Create workspace
        </Button>
      </form>
      <p className="mt-5 text-center text-[12.5px] text-foreground-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
