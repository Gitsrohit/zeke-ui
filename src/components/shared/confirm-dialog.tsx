"use client";

import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  loading?: boolean;
  confirmIcon?: ReactNode;
  onConfirm: () => void;
}

/** Accessible confirmation (focus-trapped, Escape to cancel). Used for every destructive or AI-proposed action. */
export function ConfirmDialog({ open, onOpenChange, title, description, children, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", loading, confirmIcon, onConfirm }: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-open:animate-in data-open:fade-in-0" />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg bg-surface p-[22px] shadow-pop outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98]">
          <AlertDialogPrimitive.Title className="font-display text-base font-semibold">{title}</AlertDialogPrimitive.Title>
          {description && <AlertDialogPrimitive.Description className="text-[12.5px] text-foreground-muted">{description}</AlertDialogPrimitive.Description>}
          {children}
          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline" disabled={loading}>
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              variant={tone === "destructive" ? "destructive" : "accent"}
              loading={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {!loading && confirmIcon}
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
