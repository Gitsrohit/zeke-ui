import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/features/auth/components/signup-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return <SignupForm />;
}
