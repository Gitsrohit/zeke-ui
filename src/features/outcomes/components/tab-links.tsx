import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabLink {
  href: string;
  label: string;
  active: boolean;
  count?: number;
}

/** URL-driven tabs (state lives in the query string, so views are linkable). */
export function TabLinks({ tabs, label, className }: { tabs: TabLink[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("mb-5 flex gap-5 overflow-x-auto border-b border-border scrollbar-thin", className)}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:text-foreground",
            t.active ? "border-violet text-primary" : "border-transparent text-foreground-faint hover:text-foreground-muted",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-surface-muted px-1.5 font-mono text-[10.5px] text-foreground-muted ring-1 ring-border">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
