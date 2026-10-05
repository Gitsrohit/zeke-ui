import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className }: { title: string; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold sm:text-[23px]">{title}</h1>
        {description && <p className="mt-1 max-w-[620px] text-[13.5px] text-foreground-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
