import { formatCurrency, formatSigned } from "@/lib/utils/format";

/** Serializable formatter names, so Server Components can configure client charts. */
export type ValueFormat = "number" | "currency" | "signed1" | "percent";

export function resolveFormat(format?: ((v: number) => string) | ValueFormat, fallback: (v: number) => string = (v) => String(Math.round(v))): (v: number) => string {
  if (typeof format === "function") return format;
  switch (format) {
    case "currency":
      return (v) => formatCurrency(v);
    case "signed1":
      return (v) => formatSigned(v, 1);
    case "percent":
      return (v) => `${Math.round(v)}%`;
    case "number":
      return (v) => Math.round(v).toLocaleString("en-US");
    default:
      return fallback;
  }
}
