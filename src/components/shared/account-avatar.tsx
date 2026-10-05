import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";

export function AccountAvatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[7px] bg-primary-tint font-display font-bold text-primary",
        size === "sm" && "size-6 text-[10.5px]",
        size === "md" && "size-[30px] text-[12.5px]",
        size === "lg" && "size-10 text-[15px]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
