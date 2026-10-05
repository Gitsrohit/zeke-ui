import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionTitle({ icon: Icon, children, hint, actions, className, as: Tag = "h2" }: { icon?: LucideIcon; children: ReactNode; hint?: ReactNode; actions?: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("mt-7 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <Tag className="flex items-center gap-2 text-[14.5px] font-semibold">
        {Icon && <Icon className="size-4 text-primary" aria-hidden />}
        {children}
      </Tag>
      {hint && <span className="text-[11.5px] text-foreground-faint">{hint}</span>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
