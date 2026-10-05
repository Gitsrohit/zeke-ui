"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUiStore } from "@/stores/ui-store";
import { BrandMark } from "./brand";
import { NavLinks, type NavCounts } from "./nav-links";
import { UserMenu, type ShellUser } from "./user-menu";

export function MobileNav({ counts, user }: { counts: NavCounts; user: ShellUser }) {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[280px] border-r-0 bg-sidebar text-sidebar-foreground" aria-describedby={undefined}>
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 pt-[18px] pb-4">
          <BrandMark />
          <SheetTitle className="text-[17px] font-bold text-white">Zeke AI</SheetTitle>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 py-3.5" aria-label="Main navigation">
          <NavLinks counts={counts} onNavigate={() => setOpen(false)} />
        </nav>
        <div className="border-t border-sidebar-border px-2.5 py-3">
          <UserMenu user={user} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
