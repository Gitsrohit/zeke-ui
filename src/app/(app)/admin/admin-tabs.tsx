"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/users", label: "Users & roles" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="mb-5 flex gap-5 overflow-x-auto border-b border-border scrollbar-thin">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-1 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
              active ? "border-violet text-primary" : "border-transparent text-foreground-faint hover:text-foreground-muted",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
