import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error wiring. Pass `aria-describedby={describedBy(id, error, hint)}` to the control. */
export function Field({ id, label, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn("mb-3.5", className)}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-foreground-muted">
        {label}
        {required && <span className="text-critical" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[11.5px] text-foreground-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11.5px] text-critical">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: ReactNode): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-3.5 rounded-md border border-critical/30 bg-critical-tint px-3 py-2 text-[12.5px] text-critical">
      {message}
    </div>
  );
}
