import { BrandMark } from "@/components/layout/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandMark />
          <div>
            <div className="font-display text-[17px] font-bold">Zeke AI</div>
            <div className="text-[10.5px] tracking-[0.03em] text-foreground-faint">Digital Customer Success</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-7">{children}</div>
      </div>
    </main>
  );
}
