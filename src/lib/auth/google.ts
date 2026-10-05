import "server-only";
import { Google } from "arctic";
import { env, isGoogleAuthConfigured } from "@/lib/env";

export const GOOGLE_STATE_COOKIE = "zeke_google_state";
export const GOOGLE_VERIFIER_COOKIE = "zeke_google_verifier";

export function getGoogleClient(): Google | null {
  if (!isGoogleAuthConfigured()) return null;
  const e = env();
  return new Google(e.GOOGLE_CLIENT_ID!, e.GOOGLE_CLIENT_SECRET!, `${e.APP_URL}/api/auth/google/callback`);
}
