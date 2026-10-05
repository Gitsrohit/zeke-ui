"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/invite/${token}` : `${window.location.origin}/invite/${token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied.");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };
  return (
    <div className="space-y-2">
      <label htmlFor="invite-url" className="block text-xs font-semibold text-foreground-muted">
        One-time invite link
      </label>
      <div className="flex gap-2">
        <input id="invite-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface-muted px-2.5 font-mono text-[11.5px]" />
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="rounded-md bg-stable-tint px-3 py-2 text-[12px] text-stable">
        Email delivery isn&apos;t configured in this environment — share this link directly. It expires in 14 days.
      </p>
    </div>
  );
}
