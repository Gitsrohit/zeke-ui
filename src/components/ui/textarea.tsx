import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[72px] w-full resize-y rounded-md border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none placeholder:text-foreground-faint focus-visible:border-violet focus-visible:ring-3 focus-visible:ring-violet/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-faint aria-invalid:border-critical",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
