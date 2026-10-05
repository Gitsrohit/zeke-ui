import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { AccountsTable } from "@/features/accounts/components/accounts-table";
import { loadLaunchableAgents } from "@/features/accounts/components/load-launchable-agents";
import { NewAccountButton } from "@/features/accounts/components/new-account-button";
import { getAccountFilterOptions } from "@/features/accounts/services/account.service";
import { getServiceContext } from "@/lib/auth/session";
import { can } from "@/lib/server/context";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const ctx = await getServiceContext();
  if (!can(ctx, "accounts.read")) return <PermissionDenied permission="accounts.read" />;
  const [options, agents] = await Promise.all([getAccountFilterOptions(ctx), loadLaunchableAgents(ctx)]);
  return (
    <>
      <PageHeader
        title="All accounts"
        description="Every account you have access to, scored against its lifecycle × segment scorecard. Filter, sort, export or launch an agent for a selection."
        actions={can(ctx, "accounts.write") ? <NewAccountButton options={options} /> : undefined}
      />
      <AccountsTable options={options} agents={agents} canLaunch={can(ctx, "agents.launch")} />
    </>
  );
}
