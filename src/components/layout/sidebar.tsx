import { BrandMark } from "./brand";
import { NavLinks, type NavCounts } from "./nav-links";
import { UserMenu, type ShellUser } from "./user-menu";

export interface ShellWorkspace {
  name: string;
  accountCount: number;
}

/** Persistent rail: full width on desktop, icon-only on tablet, hidden on mobile (drawer instead). */
export function Sidebar({ counts, user, workspace }: { counts: NavCounts; user: ShellUser; workspace: ShellWorkspace }) {
  return (
    <aside className="hidden h-dvh shrink-0 flex-col border-r border-[#0f0820] bg-sidebar text-sidebar-foreground md:flex md:w-[76px] lg:w-[var(--sidebar-width)]" aria-label="Primary">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 pt-[18px] pb-4 md:max-lg:justify-center md:max-lg:px-0">
        <BrandMark />
        <div className="min-w-0 md:max-lg:hidden">
          <div className="font-display text-[17px] font-bold text-white">Zeke AI</div>
          <div className="text-[10.5px] tracking-[0.03em] text-sidebar-muted">Digital Customer Success</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5" aria-label="Main navigation">
        <NavLinks counts={counts} collapsible />
      </nav>
      <div className="border-t border-sidebar-border px-2.5 py-3">
        <div className="mb-2 px-1.5 text-[11.5px] md:max-lg:hidden">
          <div className="font-semibold text-[#d7d2e8]">{workspace.name}</div>
          <div className="text-sidebar-muted">{workspace.accountCount} accounts tracked</div>
        </div>
        <UserMenu user={user} collapsible />
      </div>
    </aside>
  );
}
