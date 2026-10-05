export const DAY_MS = 86_400_000;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** Whole days since a timestamp (null-safe). */
export function daysSince(date: Date | null | undefined, now: Date = new Date()): number | null {
  return date ? Math.max(0, daysBetween(date, now)) : null;
}

/** Whole days until an ISO date string (YYYY-MM-DD), negative if in the past. */
export function daysUntil(isoDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First day of the month (UTC) `offset` months from `date`, as YYYY-MM-DD. */
export function monthStart(date: Date, offset = 0): string {
  return toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)));
}

export function monthLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}
