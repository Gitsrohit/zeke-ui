import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE } from "@/lib/auth/constants";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Optimistic edge checks only — real authorisation happens in the service layer.
 *  - Redirects signed-out visitors away from app pages.
 *  - Rejects cross-origin state-changing API requests (CSRF defence for Route Handlers;
 *    Server Actions have their own origin check).
 *  - Adds security headers.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method) && !pathname.startsWith("/api/cron")) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return NextResponse.json({ error: { message: "Cross-origin request rejected", code: "csrf" } }, { status: 403 });
    }
  }

  if (!hasSession && !isPublic(pathname) && !pathname.startsWith("/api/")) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
