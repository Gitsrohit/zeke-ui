import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { listAccountFacts } from "@/features/accounts/services/account.service";
import { getAgentLibrary } from "@/features/agents/services/agent.service";
import { TabLinks } from "@/features/outcomes/components/tab-links";
import { WorkFilters } from "@/features/work/components/work-filters";
import { WorkList } from "@/features/work/components/work-list";
import { getWorkQueue, workQuerySchema, type WorkQuery } from "@/features/work/services/work.service";
import { getServiceContext } from "@/lib/auth/session";
import { loadOrDeny } from "@/features/outcomes/components/load";
import { can } from "@/lib/server/context";

export const metadata: Metadata = { title: "My Work" };

function href(query: WorkQuery, patch: Partial<WorkQuery>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.view !== "open") params.set("view", next.view);
  if (next.filter !== "all") params.set("filter", next.filter);
  if (next.owner !== "me") params.set("owner", next.owner);
  if (next.accountId) params.set("accountId", next.accountId);
  if (next.agentId) params.set("agentId", next.agentId);
  const s = params.toString();
  return s ? `/my-work?${s}` : "/my-work";
}

export default async function MyWorkPage({ searchParams }: PageProps<"/my-work">) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const parsed = workQuerySchema.safeParse(flat);
  const query: WorkQuery = parsed.success ? parsed.data : workQuerySchema.parse({});
  const ctx = await getServiceContext();

  const data = await loadOrDeny(() => Promise.all([getWorkQueue(ctx, query), listAccountFacts(ctx), getAgentLibrary(ctx)]));
  if (!data) return <PermissionDenied permission="accounts.read" />;
  const [queue, accounts, agents] = data;
  const canManage = can(ctx, "work.manage");
  const isManager = can(ctx, "agents.manage");
  const filters: Array<{ key: WorkQuery["filter"]; label: string }> = [
    { key: "all", label: "All" },
    { key: "today", label: "Due today" },
    { key: "overdue", label: "Overdue" },
    { key: "high", label: "High priority" },
    { key: "agent", label: "From agents" },
    { key: "manual", label: "Manual" },
  ];

  return (
    <>
      <PageHeader
        title="Everything waiting on a person"
        description="Every task, approval and decision across every running agent, in one queue — instead of buried inside separate sequences."
      />
      <TabLinks
        label="Whose work"
        className="mb-3"
        tabs={[
          { href: href(query, { owner: "me" }), label: "My items", active: query.owner === "me", count: queue.counts.mine },
          { href: href(query, { owner: "all" }), label: "Everyone", active: query.owner === "all", count: queue.counts.everyone },
        ]}
      />
      <WorkFilters
        query={query}
        owners={queue.owners}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name })).sort((a, b) => a.name.localeCompare(b.name))}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        views={(["open", "snoozed", "completed"] as const).map((v) => ({ key: v, href: href(query, { view: v }), active: query.view === v }))}
        chips={filters.map((f) => ({ ...f, href: href(query, { filter: f.key }), active: query.filter === f.key }))}
      />
      <WorkList
        key={JSON.stringify(query)}
        items={queue.items}
        owners={queue.owners}
        view={query.view}
        currentUserId={ctx.userId}
        canManage={canManage}
        canActOnOthers={isManager}
        emptyHint={query.owner === "me" ? "No items waiting on you right now." : "No items match these filters."}
      />
    </>
  );
}
