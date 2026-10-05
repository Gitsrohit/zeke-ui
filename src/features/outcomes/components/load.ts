import { ForbiddenError } from "@/lib/errors";

/** Loads page data, returning null when the viewer lacks permission (so the page renders PermissionDenied). */
export async function loadOrDeny<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ForbiddenError) return null;
    throw error;
  }
}
