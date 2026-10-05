"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, startSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { parseInput, runAction, type ActionResult } from "@/lib/server/action";
import { acceptInvitation, authenticateWithPassword, registerOrganization } from "./auth.service";
import { acceptInviteSchema, loginSchema, signupSchema } from "./schemas";

async function ip(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "local";
}

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = parseInput(loginSchema, input);
    rateLimit(`login:${await ip()}`, 10, 60_000);
    rateLimit(`login:${data.email.toLowerCase()}`, 5, 60_000);
    const principal = await authenticateWithPassword(data);
    await startSession(principal.userId, principal.organizationId);
    return { redirectTo: safeNext(next) };
  });
}

export async function signupAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = parseInput(signupSchema, input);
    rateLimit(`signup:${await ip()}`, 5, 10 * 60_000);
    const principal = await registerOrganization(data);
    await startSession(principal.userId, principal.organizationId);
    return { redirectTo: "/dashboard" };
  });
}

export async function acceptInviteAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = parseInput(acceptInviteSchema, input);
    rateLimit(`invite:${await ip()}`, 10, 10 * 60_000);
    const principal = await acceptInvitation(data);
    await startSession(principal.userId, principal.organizationId);
    return { redirectTo: "/dashboard" };
  });
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
