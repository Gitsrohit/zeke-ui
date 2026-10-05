"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { describedBy, Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "../actions";
import { loginSchema, type LoginInput } from "../schemas";

export function LoginForm({ next, googleEnabled, initialError, showDemoHint }: { next?: string; googleEnabled: boolean; initialError?: string | null; showDemoHint: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setError, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors } = formState;

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setFormError(null);
      const result = await loginAction(values, next);
      if (result.ok) {
        router.push(result.data.redirectTo);
        router.refresh();
        return;
      }
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (key === "email" || key === "password") setError(key, { message: messages[0] });
      }
      setFormError(result.error);
    }),
  );

  return (
    <>
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="mt-1 mb-5 text-[13px] text-foreground-muted">Welcome back. Sign in to your workspace.</p>
      <FormError message={formError} />
      <form onSubmit={onSubmit} noValidate>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email", errors.email?.message)} {...register("email")} />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={describedBy("password", errors.password?.message)} {...register("password")} />
        </Field>
        <Button type="submit" className="mt-1 w-full" size="lg" loading={pending}>
          Sign in
        </Button>
      </form>
      {googleEnabled && (
        <>
          <div className="my-4 flex items-center gap-3 text-[11px] text-foreground-faint uppercase before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or</div>
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href="/api/auth/google">Continue with Google</a>
          </Button>
        </>
      )}
      <p className="mt-5 text-center text-[12.5px] text-foreground-muted">
        New to Zeke?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Create a workspace
        </Link>
      </p>
      {showDemoHint && (
        <p className="mt-4 rounded-md bg-surface-muted px-3 py-2 text-center font-mono text-[11px] text-foreground-muted">Demo: maya.chen@zeke.dev / zeke-demo-2026</p>
      )}
    </>
  );
}
