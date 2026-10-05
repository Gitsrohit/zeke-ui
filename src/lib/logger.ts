type Level = "info" | "warn" | "error";

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...meta });
  if (typeof process !== "undefined" && process.stderr?.write) process.stderr.write(`${line}\n`);
}

/** Structured server logger (JSON lines on stderr). */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "test") write("info", message, meta);
  },
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) =>
    write("error", message, {
      ...meta,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    }),
};
