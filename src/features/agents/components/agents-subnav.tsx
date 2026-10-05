"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/agents", label: "Library" },
  { href: "/agents/analytics", label: "Analytics" },
];

export function AgentsSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Agents sections" className="mb-5 flex gap-5 overflow-x-auto border-b border-border">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-1 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
              active ? "border-violet text-primary" : "border-transparent text-foreground-faint hover:text-foreground-muted",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
