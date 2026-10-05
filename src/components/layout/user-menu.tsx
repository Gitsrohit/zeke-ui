"use client";

import { LogOut, UserRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";

export interface ShellUser {
  name: string;
  email: string;
  roleName: string;
  title: string | null;
}

export function UserMenu({ user, collapsible = false }: { user: ShellUser; collapsible?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[7px] p-1.5 text-left transition-colors outline-none hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          collapsible && "md:max-lg:justify-center",
        )}
        aria-label={`Account menu for ${user.name}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-display text-xs font-bold text-white">{initials(user.name)}</span>
        <span className={cn("min-w-0", collapsible && "md:max-lg:hidden")}>
          <span className="block truncate text-[12.5px] font-semibold text-white">{user.name}</span>
          <span className="block truncate text-[11px] text-sidebar-muted">{user.title ?? user.roleName}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="text-[13px] font-semibold">{user.name}</div>
          <div className="truncate text-xs text-foreground-faint">{user.email}</div>
          <div className="mt-1 font-mono text-[10.5px] text-primary uppercase">{user.roleName}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound /> Profile settings are managed by your admin
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logoutAction()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
