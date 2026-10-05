"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheck, Info, TriangleAlert, OctagonX, Loader2 } from "lucide-react";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-4 text-violet" />,
        info: <Info className="size-4 text-violet" />,
        warning: <TriangleAlert className="size-4 text-stable" />,
        error: <OctagonX className="size-4 text-critical" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!bg-primary-dark !text-white !border-primary-dark !rounded-lg !shadow-pop !text-[13px]",
          description: "!text-white/70",
          actionButton: "!bg-violet !text-white",
        },
      }}
      {...props}
    />
  );
}
