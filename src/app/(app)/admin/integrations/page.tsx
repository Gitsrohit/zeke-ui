import { Info, Link2 } from "lucide-react";
import { SectionTitle } from "@/components/shared/section-title";
import { IntegrationCard } from "@/features/integrations/components/integration-card";
import { getIntegrations } from "@/features/integrations/services/integration.service";
import { getServiceContext } from "@/lib/auth/session";
import { can } from "@/lib/server/context";

export const metadata = { title: "Integrations" };

export default async function AdminIntegrationsPage() {
  const ctx = await getServiceContext();
  const integrations = await getIntegrations(ctx);
  const canManage = can(ctx, "integrations.manage");
  const connected = integrations.filter((i) => i.status === "connected").length;

  return (
    <>
      <SectionTitle icon={Link2} className="mt-0" hint={`${connected} of ${integrations.length} connected`}>
        Integrations
      </SectionTitle>
      <div role="note" className="mb-4 flex gap-2.5 rounded-lg border border-violet/20 bg-violet-tint px-4 py-3 text-[12.5px] text-foreground-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-violet-deep" aria-hidden />
        <p>Connectors run in demo mode in this environment: connection state, schedules and sync runs are recorded, but no data is exchanged with external systems.</p>
      </div>
      {!canManage && (
        <p className="mb-3 text-[12.5px] text-foreground-muted">
          Connecting and syncing integrations requires <code className="font-mono text-[11.5px] text-foreground">integrations.manage</code>.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {integrations.map((it) => (
          <IntegrationCard
            key={it.key}
            canManage={canManage}
            integration={{
              key: it.key,
              name: it.name,
              code: it.code,
              category: it.category,
              description: it.description,
              status: it.status,
              feeds: it.feeds,
              config: it.config ? { syncFrequency: it.config.syncFrequency } : null,
              lastSyncedAt: it.lastSyncedAt,
              lastSyncStatus: it.lastSyncStatus,
              connectedAt: it.connectedAt,
              connectedByName: it.connectedByName,
            }}
          />
        ))}
      </div>
    </>
  );
}
