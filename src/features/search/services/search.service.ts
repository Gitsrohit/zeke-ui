import { and, eq, ilike, or } from "drizzle-orm";
import { searchAccountRows } from "@/features/accounts/repositories/account.repository";
import { listAgents } from "@/features/agents/repositories/agent.repository";
import { listAudiences } from "@/features/audiences/repositories/audience.repository";
import { db } from "@/lib/db/client";
import { accountContacts, accounts, contacts, opportunities, workItems } from "@/lib/db/schema";
import { assertPermission, type ServiceContext } from "@/lib/server/context";
import { formatCurrency } from "@/lib/utils/format";
import type { SearchResults } from "../types";

const LIMIT = 5;

export async function globalSearch(ctx: ServiceContext, raw: string): Promise<SearchResults> {
  assertPermission(ctx, "accounts.read");
  const q = raw.trim().slice(0, 80);
  const empty: SearchResults = { accounts: [], contacts: [], opportunities: [], audiences: [], agents: [], tasks: [] };
  if (q.length < 2) return empty;
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const lower = q.toLowerCase();

  // Contacts/opportunities/tasks are joined to accounts so segment scope applies via the visible account list.
  const visible = await searchAccountRows(db, ctx, "", 10_000);
  const visibleIds = new Set(visible.map((a) => a.id));

  const [accountRows, contactRows, oppRows, taskRows, audiences, agents] = await Promise.all([
    searchAccountRows(db, ctx, q, LIMIT),
    db
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, title: contacts.title, accountId: accounts.id, accountName: accounts.name })
      .from(contacts)
      .innerJoin(accountContacts, eq(accountContacts.contactId, contacts.id))
      .innerJoin(accounts, eq(accountContacts.accountId, accounts.id))
      .where(and(eq(contacts.organizationId, ctx.organizationId), or(ilike(contacts.firstName, pattern), ilike(contacts.lastName, pattern), ilike(contacts.email, pattern))))
      .limit(25),
    db
      .select({ id: opportunities.id, name: opportunities.name, amount: opportunities.amount, stage: opportunities.stage, accountId: opportunities.accountId })
      .from(opportunities)
      .where(and(eq(opportunities.organizationId, ctx.organizationId), ilike(opportunities.name, pattern)))
      .limit(25),
    db
      .select({ id: workItems.id, title: workItems.title, status: workItems.status, accountId: workItems.accountId })
      .from(workItems)
      .where(and(eq(workItems.organizationId, ctx.organizationId), ilike(workItems.title, pattern)))
      .limit(25),
    listAudiences(db, ctx.organizationId),
    listAgents(db, ctx.organizationId),
  ]);

  return {
    accounts: accountRows.map((a) => ({ id: a.id, title: a.name, subtitle: `${a.lifecycle} · ${a.segment} · ${formatCurrency(a.arr)}`, href: `/accounts/${a.id}` })),
    contacts: contactRows
      .filter((c) => visibleIds.has(c.accountId))
      .slice(0, LIMIT)
      .map((c) => ({ id: `${c.id}-${c.accountId}`, title: `${c.firstName} ${c.lastName}`, subtitle: `${c.title ?? "Contact"} · ${c.accountName}`, href: `/accounts/${c.accountId}?tab=contacts` })),
    opportunities: oppRows
      .filter((o) => visibleIds.has(o.accountId))
      .slice(0, LIMIT)
      .map((o) => ({ id: o.id, title: o.name, subtitle: `${o.stage.replace("_", " ")} · ${formatCurrency(o.amount)}`, href: `/accounts/${o.accountId}?tab=opportunities` })),
    audiences: audiences
      .filter((a) => a.name.toLowerCase().includes(lower))
      .slice(0, LIMIT)
      .map((a) => ({ id: a.id, title: a.name, subtitle: a.type === "static" ? "Static snapshot" : "Live audience", href: `/audiences/${a.id}` })),
    agents: agents
      .filter((a) => a.name.toLowerCase().includes(lower) || a.category.toLowerCase().includes(lower))
      .slice(0, LIMIT)
      .map((a) => ({ id: a.id, title: a.name, subtitle: `${a.category} · ${a.status}`, href: `/agents/${a.id}` })),
    tasks: taskRows
      .filter((t) => !t.accountId || visibleIds.has(t.accountId))
      .slice(0, LIMIT)
      .map((t) => ({ id: t.id, title: t.title, subtitle: t.status, href: t.accountId ? `/accounts/${t.accountId}?tab=tasks` : "/my-work" })),
  };
}
