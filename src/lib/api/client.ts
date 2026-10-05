export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Typed JSON fetcher for TanStack Query. Throws ApiError with the server's user-safe message. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    let code: string | undefined;
    try {
      const body = (await response.json()) as { error?: { message?: string; code?: string } };
      message = body.error?.message ?? message;
      code = body.error?.code;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApiError(message, response.status, code);
  }
  return (await response.json()) as T;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, { method: "POST", body: JSON.stringify(body) });
}
