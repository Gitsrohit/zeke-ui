import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-border-strong bg-surface px-2.5 text-[13px] text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-foreground-faint focus-visible:border-violet focus-visible:ring-3 focus-visible:ring-violet/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-faint aria-invalid:border-critical aria-invalid:ring-critical/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
