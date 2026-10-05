import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps a Route Handler with consistent JSON error responses. */
export function withApi<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (isAppError(error)) {
        const headers: Record<string, string> = {};
        if (error.code === "rate_limited" && typeof error.details?.retryAfterSeconds === "number") {
          headers["Retry-After"] = String(error.details.retryAfterSeconds);
        }
        return NextResponse.json({ error: { message: error.message, code: error.code, details: error.details } }, { status: error.status, headers });
      }
      logger.error("API request failed", error, { url: request.url, method: request.method });
      return NextResponse.json({ error: { message: "Something went wrong. Please try again.", code: "internal_error" } }, { status: 500 });
    }
  };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}
