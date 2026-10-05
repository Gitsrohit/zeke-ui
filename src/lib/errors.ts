/** Domain errors carry an HTTP-ish status and a user-safe message. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(`${entity} not found`, 404, "not_found");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "forbidden");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You need to sign in") {
    super(message, 401, "unauthorized");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, "validation_error", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, "conflict", details);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super("Too many requests — please wait and try again", 429, "rate_limited", { retryAfterSeconds });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Message safe to show to users — never leaks internals for unexpected errors. */
export function toUserMessage(error: unknown): string {
  return isAppError(error) ? error.message : "Something went wrong. Please try again.";
}
