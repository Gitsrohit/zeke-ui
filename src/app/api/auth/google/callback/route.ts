import { decodeIdToken } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticateWithGoogle } from "@/features/auth/auth.service";
import { getGoogleClient, GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE } from "@/lib/auth/google";
import { startSession } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface GoogleClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  const google = getGoogleClient();
  if (!google) return fail("google_not_configured");

  const store = await cookies();
  const expectedState = store.get(GOOGLE_STATE_COOKIE)?.value;
  const verifier = store.get(GOOGLE_VERIFIER_COOKIE)?.value;
  store.delete(GOOGLE_STATE_COOKIE);
  store.delete(GOOGLE_VERIFIER_COOKIE);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !expectedState || !verifier || state !== expectedState) return fail("google_state");

  try {
    const tokens = await google.validateAuthorizationCode(code, verifier);
    const claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
    const principal = await authenticateWithGoogle({
      subject: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: claims.name ?? claims.email.split("@")[0],
      picture: claims.picture ?? null,
    });
    await startSession(principal.userId, principal.organizationId);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    if (!isAppError(error)) logger.error("Google sign-in failed", error);
    return fail(isAppError(error) && error.status === 401 ? "google_denied" : "google_failed");
  }
}
