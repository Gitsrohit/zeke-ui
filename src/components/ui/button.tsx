import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[7px] border font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-violet/30 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:border-primary-dark hover:bg-primary-dark",
        accent: "border-violet bg-violet text-white hover:border-violet-deep hover:bg-violet-deep",
        outline: "border-border-strong bg-surface text-foreground hover:border-foreground-faint hover:bg-surface-muted aria-expanded:bg-surface-muted",
        secondary: "border-border bg-surface-muted text-foreground hover:bg-border/60",
        ghost: "border-transparent bg-transparent text-foreground-muted hover:bg-surface-muted hover:text-foreground aria-expanded:bg-surface-muted",
        destructive: "border-critical/40 bg-surface text-critical hover:border-critical hover:bg-critical-tint",
        link: "border-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3.5 text-[13px]",
        sm: "h-7 px-2.5 text-xs",
        xs: "h-6 gap-1 px-2 text-[11.5px] [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 px-4 text-sm",
        icon: "size-8",
        "icon-sm": "size-7",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
