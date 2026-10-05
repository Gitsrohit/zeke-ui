"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, resolveNav } from "@/config/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface NavCounts {
  work: number;
  risk: number;
}

export function NavLinks({ counts, collapsible = false, onNavigate }: { counts: NavCounts; collapsible?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { active } = resolveNav(pathname);
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = active?.href === item.href;
        const count = item.badge ? counts[item.badge] : 0;
        const link = (
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-[11px] rounded-[7px] px-3 py-[9px] text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              isActive ? "bg-sidebar-primary font-semibold text-white" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white",
              collapsible && "md:max-lg:justify-center md:max-lg:px-0",
            )}
          >
            <item.icon className="size-[17px] shrink-0" aria-hidden />
            <span className={cn("truncate", collapsible && "md:max-lg:sr-only")}>{item.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] font-mono text-[10.5px] font-bold text-white",
                  item.badge === "risk" ? "bg-critical" : isActive ? "bg-white/25" : "bg-white/15",
                  collapsible && "md:max-lg:absolute md:max-lg:top-1 md:max-lg:right-1.5 md:max-lg:ml-0",
                )}
                aria-label={item.badge === "risk" ? `${count} flagged accounts` : `${count} open items`}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
        return (
          <li key={item.href} className="relative">
            {collapsible ? (
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="hidden md:max-lg:block">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        );
      })}
    </ul>
  );
}
