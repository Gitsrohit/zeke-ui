export function formatCurrency(value: number, { compact = true }: { compact?: boolean } = {}): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
    return `$${Math.round(value)}`;
  }
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatSigned(value: number, decimals = 0): string {
  const n = decimals ? value.toFixed(decimals) : String(Math.round(value));
  return value > 0 ? `+${n}` : n;
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && w[0] === w[0].toUpperCase());
  const letters = words.slice(0, 2).map((w) => w[0]).join("");
  return (letters || name.slice(0, 2)).toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatRelativeDays(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  return `${days}d ago`;
}

export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 0) {
    const future = -s;
    if (future < 3600) return `in ${Math.max(1, Math.round(future / 60))}m`;
    if (future < 86400) return `in ${Math.round(future / 3600)}h`;
    return `in ${Math.round(future / 86400)}d`;
  }
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date.length === 10 ? `${date}T00:00:00Z` : date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
