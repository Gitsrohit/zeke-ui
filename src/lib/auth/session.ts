import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  deleteSession,
  findSessionPrincipal,
  insertSession,
  touchMembership,
  type SessionPrincipal,
} from "@/features/users/repositories/user.repository";
import { db } from "@/lib/db";
import { UnauthorizedError } from "@/lib/errors";
import { isRoleKey, PERMISSIONS, type Permission } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/server/context";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "./constants";
import { generateToken, hashToken } from "./tokens";

const ACTIVITY_TOUCH_MS = 5 * 60_000;

async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ipAddress: forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  };
}

/** Creates a session and sets the cookie. Only callable from Server Actions / Route Handlers. */
export async function startSession(userId: string, organizationId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const meta = await requestMeta();
  await insertSession(db, { id: hashToken(token), userId, organizationId, expiresAt, ipAddress: meta.ipAddress, userAgent: meta.userAgent });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(db, hashToken(token));
  store.delete(SESSION_COOKIE);
}

/** The current principal, memoised per request. */
export const getSession = cache(async (): Promise<SessionPrincipal | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = new Date();
  const principal = await findSessionPrincipal(db, hashToken(token), now);
  if (!principal) return null;
  if (!principal.lastActiveAt || now.getTime() - principal.lastActiveAt.getTime() > ACTIVITY_TOUCH_MS) {
    await touchMembership(db, principal.membershipId, now);
  }
  return principal;
});

/** For pages and layouts: redirects to the login page when signed out. */
export async function requireSession(): Promise<SessionPrincipal> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

function toPermissions(granted: string[]): Permission[] {
  return granted.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p));
}

export function principalToContext(principal: SessionPrincipal, request?: ServiceContext["request"]): ServiceContext {
  return {
    organizationId: principal.organizationId,
    userId: principal.userId,
    userName: principal.name,
    role: isRoleKey(principal.role) ? principal.role : "viewer",
    permissions: toPermissions(principal.permissions),
    segmentScope: principal.segmentScope,
    request,
  };
}

/** Service context for pages (redirects when signed out). */
export const getServiceContext = cache(async (): Promise<ServiceContext> => {
  const principal = await requireSession();
  return principalToContext(principal, await requestMeta());
});

/** Service context for Route Handlers and Server Actions (throws 401 when signed out). */
export async function requireApiContext(): Promise<ServiceContext> {
  const principal = await getSession();
  if (!principal) throw new UnauthorizedError();
  return principalToContext(principal, await requestMeta());
}
