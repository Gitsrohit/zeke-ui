"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchJson } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/format";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchJson<{ items: NotificationItem[]; unread: number }>(API.notifications),
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => fetchJson(API.notifications, { method: "PATCH", body: JSON.stringify({ ids }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-[34px]" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 font-mono text-[10px] font-bold text-white">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <Button variant="ghost" size="xs" disabled={!unread || markRead.isPending} onClick={() => markRead.mutate(undefined)}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {isError ? (
            <div className="p-4 text-center text-[12.5px] text-foreground-muted">
              Couldn&apos;t load notifications.{" "}
              <button className="font-semibold text-primary underline" onClick={() => void refetch()}>
                Retry
              </button>
            </div>
          ) : !data ? (
            <div className="space-y-2 p-4">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
            </div>
          ) : data.items.length === 0 ? (
            <p className="p-6 text-center text-[12.5px] text-foreground-faint">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {data.items.map((n) => {
                const content = (
                  <>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-violet")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">{n.title}</span>
                      {n.body && <span className="block text-xs text-foreground-muted">{n.body}</span>}
                      <span className="mt-0.5 block font-mono text-[10.5px] text-foreground-faint">{formatRelativeTime(n.createdAt)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id} className="border-b border-border last:border-0">
                    {n.href ? (
                      <Link
                        href={n.href}
                        className="flex gap-2.5 px-4 py-3 hover:bg-surface-muted"
                        onClick={() => {
                          if (!n.readAt) markRead.mutate([n.id]);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex gap-2.5 px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
