"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({ title = "Something went wrong", description = "We couldn't load this. Check your connection and try again.", onRetry, className }: { title?: string; description?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-5 py-12 text-center", className)}>
      <AlertTriangle className="mb-3 size-8 stroke-[1.5] text-critical" aria-hidden />
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mx-auto max-w-[340px] text-[12.5px] text-foreground-muted">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw /> Try again
        </Button>
      )}
    </div>
  );
}
