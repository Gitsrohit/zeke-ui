"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, Briefcase, Building2, ListChecks, Loader2, Sparkles, Target, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS } from "@/config/navigation";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { useUiStore } from "@/stores/ui-store";
import { SEARCH_CATEGORY_LABELS, type SearchCategory, type SearchResults } from "../types";

const CATEGORY_ICONS: Record<SearchCategory, LucideIcon> = {
  accounts: Building2,
  contacts: UserRound,
  opportunities: Briefcase,
  audiences: Target,
  agents: Bot,
  tasks: ListChecks,
};

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const openAssistant = useUiStore((s) => s.openAssistant);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 180);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => fetchJson<SearchResults>(API.search(debounced)),
    enabled: open && debounced.length >= 2,
    placeholderData: (prev) => prev,
  });

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const categories = (Object.keys(SEARCH_CATEGORY_LABELS) as SearchCategory[]).filter((c) => (data?.[c]?.length ?? 0) > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <DialogContent showCloseButton={false} className="top-[18%] max-w-[600px] translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search accounts, contacts, opportunities, audiences, agents and tasks</DialogDescription>
        <Command shouldFilter={false} label="Global search">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search accounts, contacts, agents, audiences…" />
          <CommandList>
            {debounced.length < 2 ? (
              <>
                <CommandGroup heading="Go to">
                  {NAV_ITEMS.map((item) => (
                    <CommandItem key={item.href} value={`nav-${item.href}`} onSelect={() => go(item.href)}>
                      <item.icon className="text-foreground-faint" aria-hidden />
                      {item.label}
                    </CommandItem>
                  ))}
                  <CommandItem value="nav-accounts" onSelect={() => go("/accounts")}>
                    <Building2 className="text-foreground-faint" aria-hidden />
                    All accounts
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="AI">
                  <CommandItem value="ask-zeke" onSelect={() => { setOpen(false); openAssistant(); }}>
                    <Sparkles className="text-violet" aria-hidden />
                    Ask Zeke a question about your customers
                  </CommandItem>
                </CommandGroup>
              </>
            ) : (
              <>
                {isFetching && !data && (
                  <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-foreground-faint">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
                  </div>
                )}
                {isError && <div className="py-8 text-center text-[13px] text-critical">Search failed. Try again.</div>}
                {data && categories.length === 0 && <CommandEmpty>No results for “{debounced}”.</CommandEmpty>}
                {categories.map((c) => {
                  const Icon = CATEGORY_ICONS[c];
                  return (
                    <CommandGroup key={c} heading={SEARCH_CATEGORY_LABELS[c]}>
                      {data![c].map((hit) => (
                        <CommandItem key={`${c}-${hit.id}`} value={`${c}-${hit.id}`} onSelect={() => go(hit.href)}>
                          <Icon className="text-foreground-faint" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                          <span className="truncate text-xs text-foreground-faint">{hit.subtitle}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
                <CommandSeparator />
                <CommandGroup heading="AI">
                  <CommandItem value="ask-zeke-query" onSelect={() => { setOpen(false); openAssistant(debounced); }}>
                    <Sparkles className="text-violet" aria-hidden />
                    Ask Zeke: “{debounced}”
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t border-border px-3.5 py-2 font-mono text-[10.5px] text-foreground-faint">
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
