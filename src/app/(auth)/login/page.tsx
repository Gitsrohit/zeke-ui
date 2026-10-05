import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSession } from "@/lib/auth/session";
import { isGoogleAuthConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured for this workspace yet. Sign in with email instead.",
  google_state: "Your Google sign-in session expired. Please try again.",
  google_denied: "Google sign-in was declined for this account. Use your invitation link or ask an administrator.",
  google_failed: "Google sign-in failed. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/dashboard");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? (ERROR_MESSAGES[params.error] ?? "Sign-in failed. Please try again.") : null;
  return <LoginForm next={next} googleEnabled={isGoogleAuthConfigured()} initialError={error} showDemoHint={process.env.NODE_ENV !== "production"} />;
}
