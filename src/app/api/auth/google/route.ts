import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleClient, GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE } from "@/lib/auth/google";

export async function GET(request: Request) {
  const google = getGoogleClient();
  if (!google) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  const store = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  store.set(GOOGLE_STATE_COOKIE, state, options);
  store.set(GOOGLE_VERIFIER_COOKIE, verifier, options);
  return NextResponse.redirect(url);
}
