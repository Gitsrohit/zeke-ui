"use client";

import { Menu, Search, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { resolveNav } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useUiStore } from "@/stores/ui-store";

export function Topbar() {
  const pathname = usePathname();
  const { crumb, title } = resolveNav(pathname);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const openAssistant = useUiStore((s) => s.openAssistant);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="truncate font-mono text-[11px] tracking-[0.06em] text-foreground-faint uppercase">
          {crumb}
        </nav>
        <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden h-[34px] w-[230px] items-center gap-2 rounded-[7px] border border-border bg-surface-muted px-3 text-[13px] text-foreground-faint transition-colors hover:border-border-strong sm:flex md:max-lg:w-[170px]"
          aria-label="Search accounts, agents, audiences (Command K)"
        >
          <Search className="size-[15px] shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">Search accounts, agents…</span>
          <kbd className="hidden rounded border border-border bg-surface px-1.5 font-mono text-[10.5px] lg:inline">⌘K</kbd>
        </button>
        <Button variant="outline" size="icon" className="size-[34px] sm:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
          <Search className="size-4" />
        </Button>
        <NotificationBell />
        <Button onClick={() => openAssistant()} className="h-[34px]" aria-label="Ask Zeke AI assistant">
          <Sparkles className="size-[15px]" />
          <span className="hidden sm:inline">Ask Zeke</span>
        </Button>
      </div>
    </header>
  );
}
