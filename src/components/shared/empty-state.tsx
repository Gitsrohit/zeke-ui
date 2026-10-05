import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className, compact }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center text-center text-foreground-faint", compact ? "px-4 py-6" : "px-5 py-12", className)}>
      {Icon && <Icon className="mb-3 size-8 stroke-[1.5]" aria-hidden />}
      <h3 className="mb-1 text-sm font-semibold text-foreground-muted">{title}</h3>
      {description && <p className="mx-auto max-w-[320px] text-[12.5px]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
