import { eq } from "drizzle-orm";
import { AGENT_TEMPLATES } from "@/config/agent-templates";
import { DEFAULT_BAND_THRESHOLDS, DEFAULT_WEIGHTS, HEALTH_SOURCES, LIFECYCLE_STAGES, SEGMENTS, type SourceWeights } from "@/config/health";
import { insertAgentVersion } from "@/features/agents/repositories/agent.repository";
import type { DbExecutor } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { toIsoDate } from "@/lib/utils/dates";

export interface ProvisionedOrganization {
  organizationId: string;
  workspaceId: string;
  stageIds: Map<string, string>;
  segmentIds: Map<string, string>;
  weightsByKey: Map<string, SourceWeights>;
  agentIds: Map<string, string>;
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace";
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * Creates a tenant with everything it needs to work on day one: default
 * workspace, lifecycle stages, segments, the 12 lifecycle × segment
 * scorecards, the integration catalogue (disconnected) and the agent library.
 */
export async function provisionOrganization(
  executor: DbExecutor,
  input: { name: string; slug?: string; workspaceName?: string; createdById: string | null; now?: Date; withAgents?: boolean },
): Promise<ProvisionedOrganization> {
  const now = input.now ?? new Date();
  const [org] = await executor
    .insert(s.organizations)
    .values({ name: input.name, slug: input.slug ?? slugify(input.name) })
    .returning({ id: s.organizations.id });
  const [ws] = await executor
    .insert(s.workspaces)
    .values({ organizationId: org.id, name: input.workspaceName ?? `${input.name} Workspace`, isDefault: true })
    .returning({ id: s.workspaces.id });
  await executor.insert(s.workspaceSettings).values({ organizationId: org.id });

  const stages = await executor
    .insert(s.lifecycleStages)
    .values(LIFECYCLE_STAGES.map((name, position) => ({ organizationId: org.id, name, position })))
    .returning({ id: s.lifecycleStages.id, name: s.lifecycleStages.name });
  const segs = await executor
    .insert(s.segments)
    .values(SEGMENTS.map((name, position) => ({ organizationId: org.id, name, position })))
    .returning({ id: s.segments.id, name: s.segments.name });
  const stageIds = new Map(stages.map((r) => [r.name, r.id]));
  const segmentIds = new Map(segs.map((r) => [r.name, r.id]));
  const weightsByKey = new Map<string, SourceWeights>();

  for (const stage of LIFECYCLE_STAGES) {
    for (const segment of SEGMENTS) {
      const [sc] = await executor
        .insert(s.scorecards)
        .values({ organizationId: org.id, lifecycleStageId: stageIds.get(stage)!, segmentId: segmentIds.get(segment)!, name: `${stage} · ${segment}` })
        .returning({ id: s.scorecards.id });
      const [version] = await executor
        .insert(s.scorecardVersions)
        .values({
          organizationId: org.id,
          scorecardId: sc.id,
          version: 1,
          thresholds: DEFAULT_BAND_THRESHOLDS,
          effectiveFrom: toIsoDate(new Date(now.getTime() - 365 * 86_400_000)),
          changeNote: "Initial lifecycle weighting model",
          isActive: true,
          createdById: input.createdById,
        })
        .returning({ id: s.scorecardVersions.id });
      const weights = DEFAULT_WEIGHTS[stage];
      await executor.insert(s.scorecardWeights).values(HEALTH_SOURCES.map((src) => ({ scorecardVersionId: version.id, sourceKey: src.key, weight: weights[src.key] })));
      weightsByKey.set(`${stage}|${segment}`, weights);
    }
  }

  const catalogue = await executor.select({ key: s.integrations.key }).from(s.integrations);
  if (catalogue.length) {
    await executor.insert(s.integrationConnections).values(catalogue.map((i) => ({ organizationId: org.id, integrationKey: i.key, status: "disconnected" as const })));
  }

  const agentIds = new Map<string, string>();
  if (input.withAgents !== false) {
    for (const t of AGENT_TEMPLATES) {
      const [row] = await executor
        .insert(s.agents)
        .values({
          organizationId: org.id,
          key: t.key,
          name: t.name,
          description: t.description,
          category: t.category,
          status: "active",
          triggerType: t.triggerType,
          triggerLabel: t.triggerLabel,
          targetMetric: t.targetMetric,
          cooldownDays: t.cooldownDays,
          maxAttempts: t.maxAttempts,
          eligibleLifecycles: t.eligibleLifecycles,
          createdById: input.createdById,
        })
        .returning({ id: s.agents.id });
      agentIds.set(t.key, row.id);
      const versionId = await insertAgentVersion(executor, org.id, row.id, t.steps, input.createdById);
      await executor.update(s.agents).set({ currentVersionId: versionId }).where(eq(s.agents.id, row.id));
    }
    for (const t of AGENT_TEMPLATES) {
      for (const other of t.conflictsWith) {
        const a = agentIds.get(t.key);
        const b = agentIds.get(other);
        if (a && b && a < b) await executor.insert(s.agentConflicts).values({ agentId: a, conflictsWithAgentId: b }).onConflictDoNothing();
      }
    }
  }

  return { organizationId: org.id, workspaceId: ws.id, stageIds, segmentIds, weightsByKey, agentIds };
}
