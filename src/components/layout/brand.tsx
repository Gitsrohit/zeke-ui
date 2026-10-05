import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#8b5cf6,#7c3aed_55%,#c026d3)] font-display text-base font-bold tracking-tight text-white shadow-[0_3px_10px_-2px_rgb(124_58_237/0.55)]",
        className,
      )}
    >
      Z
    </span>
  );
}
