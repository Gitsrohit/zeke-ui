import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AssistantSheet } from "@/features/ai/components/assistant-sheet";
import { getShellData } from "@/features/dashboard/services/shell.service";
import { CommandPalette } from "@/features/search/components/command-palette";
import { getServiceContext, requireSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const ctx = await getServiceContext();
  const shell = await getShellData(ctx);
  const user = { name: session.name, email: session.email, roleName: session.roleName, title: session.title };

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Sidebar counts={shell.counts} user={user} workspace={{ name: session.workspaceName ?? session.organizationName, accountCount: shell.accountCount }} />
      <MobileNav counts={shell.counts} user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" tabIndex={-1} className="flex-1 overflow-x-hidden overflow-y-auto px-4 pt-6 pb-16 outline-none sm:px-6 lg:px-[30px]">
          <div className="mx-auto w-full max-w-[1480px] animate-fade-up">{children}</div>
        </main>
      </div>
      <CommandPalette />
      <AssistantSheet />
    </div>
  );
}
