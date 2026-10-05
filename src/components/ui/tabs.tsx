"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("mb-5 flex gap-5 overflow-x-auto border-b border-border scrollbar-thin", className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px shrink-0 border-b-2 border-transparent px-1 py-2 text-[13.5px] font-semibold whitespace-nowrap text-foreground-faint transition-colors outline-none hover:text-foreground-muted focus-visible:text-foreground data-[state=active]:border-violet data-[state=active]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none data-[state=active]:animate-fade-up", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
