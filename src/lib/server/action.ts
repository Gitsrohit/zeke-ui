import type { z } from "zod";
import { isAppError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/** Validates input against a schema, throwing a ValidationError with field errors. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    const first = result.error.issues[0]?.message ?? "Invalid input";
    throw new ValidationError(first, { fieldErrors });
  }
  return result.data;
}

/** Runs a Server Action body and converts errors into a serialisable result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (isAppError(error)) {
      const fieldErrors = (error.details?.fieldErrors as Record<string, string[]> | undefined) ?? undefined;
      return { ok: false, error: error.message, code: error.code, fieldErrors };
    }
    // Next.js control-flow errors (redirect / notFound) must propagate.
    if (error instanceof Error && "digest" in error && typeof (error as { digest?: unknown }).digest === "string" && String((error as { digest: string }).digest).startsWith("NEXT_")) {
      throw error;
    }
    logger.error("Server action failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
