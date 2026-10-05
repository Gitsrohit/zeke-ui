import { and, eq, sql } from "drizzle-orm";
import {
  HEALTH_SOURCES,
  LIFECYCLE_STAGES,
  SEGMENTS,
  SUB_METRICS,
  type HealthSourceKey,
  type LifecycleStageName,
} from "@/config/health";
import { AGENT_TEMPLATES } from "@/config/agent-templates";
import { launchAgent, resolveRunStep } from "@/features/agents/services/agent-engine.service";
import type { AudienceFilter } from "@/features/audiences/domain/types";
import { calculateHealthScore, getHealthBand } from "@/features/health/domain/score";
import { metricRawFromScore, metricScoreFromRaw } from "@/features/health/domain/metrics";
import { recalculateHealthScores } from "@/features/health/services/health-calculation.service";
import { listRunSteps } from "@/features/agents/repositories/agent.repository";
import { provisionOrganization } from "@/features/users/services/provisioning.service";
import { saveAudienceTree } from "@/features/audiences/repositories/audience.repository";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { PERMISSION_DESCRIPTIONS, PERMISSIONS, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS, type RoleKey } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/server/context";
import { addDays, DAY_MS, monthStart, toIsoDate } from "@/lib/utils/dates";
import { createRandom, hashString, mulberry32, type Random } from "@/lib/utils/rng";
import {
  ARR_RANGE,
  COMPANY_NAMES,
  CONTACT_FIRST,
  CONTACT_LAST,
  CONTACT_ROLES,
  CONTACT_STATUS,
  EMAIL_SUBJECTS,
  INDUSTRY_BY_KEYWORD,
  MEETING_SUBJECTS,
  NOTE_SNIPPETS,
  OWNER_ROTATION,
  SEED_INTEGRATIONS,
  SEED_PASSWORD,
  SEED_USERS,
  TICKET_SUBJECTS,
  USER_ACTIVITY_TYPES,
} from "./data";

type Log = (message: string) => void;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const HISTORY = 12;

async function insertInChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, size = 1000) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

/** Removes every tenant and global record. Never run against production data. */
export async function resetDatabase(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE organizations, users, permissions, integrations, roles RESTART IDENTITY CASCADE`);
}

async function seedGlobals() {
  await db.insert(s.permissions).values(PERMISSIONS.map((key) => ({ key, description: PERMISSION_DESCRIPTIONS[key] })));
  const roleRows = await db
    .insert(s.roles)
    .values(ROLE_KEYS.map((key) => ({ key, name: ROLE_LABELS[key], isSystem: true, organizationId: null })))
    .returning({ id: s.roles.id, key: s.roles.key });
  const roleIds = new Map(roleRows.map((r) => [r.key as RoleKey, r.id]));
  await db.insert(s.rolePermissions).values(ROLE_KEYS.flatMap((key) => ROLE_PERMISSIONS[key].map((permissionKey) => ({ roleId: roleIds.get(key)!, permissionKey }))));
  await db.insert(s.integrations).values(SEED_INTEGRATIONS.map(({ connected: _c, ...i }) => i));
  return roleIds;
}

interface GeneratedContact {
  firstName: string;
  lastName: string;
  role: string;
  champion: boolean;
  lastEngagedDays: number;
  status: (typeof CONTACT_STATUS)[number];
}

interface GeneratedAccount {
  index: number;
  name: string;
  lifecycle: LifecycleStageName;
  segment: string;
  arr: number;
  ownerKey: string;
  sources: Record<HealthSourceKey, number>;
  lastMeetingDays: number;
  lastLoginDays: number;
  openTickets: number;
  nps: number;
  renewalInDays: number;
  hygieneContacts: number;
  hygieneTotal: number;
  trendDelta: number;
  contacts: GeneratedContact[];
  notes: Array<{ ownerKey: string; daysAgo: number; text: string }>;
}

/** Faithful port of the prototype's seeded customer generator (same RNG seed and sequence). */
function generateAccounts(rng: Random): GeneratedAccount[] {
  const out: GeneratedAccount[] = [];
  // Separate stream so the prototype's sequence is untouched: skews some accounts
  // toward strong or weak health so every band is represented.
  const profile = createRandom(31337);
  let ni = 0;
  LIFECYCLE_STAGES.forEach((lifecycle, li) => {
    SEGMENTS.forEach((segment) => {
      for (let i = 0; i < 3; i++) {
        const name = COMPANY_NAMES[ni % COMPANY_NAMES.length];
        ni++;
        const bias = li === 3 ? -6 : li === 0 ? -4 : 4;
        const roll = profile.next();
        const skew = roll < 0.22 ? profile.int(14, 22) : roll < 0.4 ? -profile.int(14, 24) : 0;
        const sources = Object.fromEntries(HEALTH_SOURCES.map((src) => [src.key, clamp(rng.int(28, 96) + bias + skew, 5, 98)])) as Record<HealthSourceKey, number>;
        const [lo, hi] = ARR_RANGE[segment];
        const account: GeneratedAccount = {
          index: ni,
          name,
          lifecycle,
          segment,
          arr: rng.int(lo, hi),
          ownerKey: OWNER_ROTATION[ni % OWNER_ROTATION.length],
          sources,
          lastMeetingDays: rng.int(1, 75),
          lastLoginDays: rng.int(0, 45),
          openTickets: rng.int(0, 6),
          nps: rng.int(-40, 80),
          renewalInDays: lifecycle === "Renewal" ? rng.int(15, 110) : rng.int(120, 360),
          hygieneContacts: rng.int(2, 9),
          hygieneTotal: rng.int(9, 11),
          trendDelta: rng.int(-14, 14),
          contacts: [],
          notes: [],
        };
        // Score history noise (kept to preserve the prototype's RNG sequence).
        for (let k = 0; k < 5; k++) rng.int(-4, 4);
        const contactCount = rng.int(2, 5);
        for (let c = 0; c < contactCount; c++) {
          account.contacts.push({
            firstName: rng.pick(CONTACT_FIRST),
            lastName: rng.pick(CONTACT_LAST),
            role: rng.pick(CONTACT_ROLES),
            champion: c === 0 ? true : rng.next() < 0.2,
            lastEngagedDays: rng.int(1, 90),
            status: c === 0 ? "active" : rng.pick(CONTACT_STATUS),
          });
        }
        const noteCount = rng.int(1, 3);
        for (let n = 0; n < noteCount; n++) account.notes.push({ ownerKey: rng.pick(OWNER_ROTATION), daysAgo: rng.int(1, 60), text: rng.pick(NOTE_SNIPPETS) });
        out.push(account);
      }
    });
  });
  return out;
}

interface MetricSeries {
  metricKey: string;
  scores: number[];
  raws: number[];
}

/**
 * Builds 12 months of sub-measure history per source, reconciled so the
 * sub-measures' weighted average equals the account's source sub-score and
 * anchored to live fields (NPS, last login, open tickets…) where they exist.
 */
function generateSourceDetail(a: GeneratedAccount): Record<HealthSourceKey, { metrics: MetricSeries[]; history: number[] }> {
  const r = mulberry32(hashString(`c${a.index}${a.name}`));
  const rr = (lo: number, hi: number) => lo + r() * (hi - lo);
  const champion = a.contacts.find((c) => c.champion);
  const anchors: Record<string, number> = {
    lastLogin: a.lastLoginDays,
    nps: a.nps,
    lastMtg: a.lastMeetingDays,
    open: a.openTickets,
    roles: (a.hygieneContacts / a.hygieneTotal) * 100,
    champion: champion?.lastEngagedDays ?? 90,
  };
  const out = {} as Record<HealthSourceKey, { metrics: MetricSeries[]; history: number[] }>;
  for (const src of HEALTH_SOURCES) {
    const S = a.sources[src.key];
    const defs = SUB_METRICS[src.key];
    const now = defs.map((m) => (m.key in anchors ? metricScoreFromRaw(m, a.segment, anchors[m.key]) : clamp(S + rr(-20, 20), 3, 99)));
    const pinned = defs.map((m) => m.key in anchors);
    for (let pass = 0; pass < 2; pass++) {
      for (let it = 0; it < 8; it++) {
        const tot = defs.reduce((acc, m, i) => acc + now[i] * m.weight, 0) / 100;
        const freeW = defs.reduce((acc, m, i) => acc + (pinned[i] ? 0 : m.weight), 0);
        if (!freeW || Math.abs(S - tot) < 0.3) break;
        defs.forEach((_, i) => {
          if (!pinned[i]) now[i] = clamp(now[i] + ((S - tot) * 100) / freeW, 3, 99);
        });
      }
      const tot = defs.reduce((acc, m, i) => acc + now[i] * m.weight, 0) / 100;
      if (Math.abs(S - tot) < 1.5) break;
      pinned.fill(false);
    }
    const metrics: MetricSeries[] = defs.map((m, i) => {
      const slope = (a.trendDelta / 6) * rr(0.2, 1.8);
      const hist = new Array<number>(HISTORY);
      hist[HISTORY - 1] = now[i];
      for (let k = HISTORY - 2; k >= 0; k--) hist[k] = clamp(hist[k + 1] - slope + rr(-4, 4), 2, 100);
      const raws = hist.map((sc) => metricRawFromScore(m, a.segment, sc));
      if (pinned[i]) raws[HISTORY - 1] = anchors[m.key];
      return { metricKey: m.key, scores: hist, raws };
    });
    let history = Array.from({ length: HISTORY }, (_, k) => metrics.reduce((acc, mt, i) => acc + mt.scores[k] * defs[i].weight, 0) / 100);
    const off = S - history[HISTORY - 1];
    history = history.map((v) => clamp(v + off, 2, 100));
    history[HISTORY - 1] = S;
    out[src.key] = { metrics, history };
  }
  return out;
}

function industryFor(name: string): string {
  return INDUSTRY_BY_KEYWORD.find(([re]) => re.test(name))?.[1] ?? "Professional Services";
}

function domainFor(name: string): string {
  return `${name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 18)}.com`;
}

export interface SeedSummary {
  organizationId: string;
  accounts: number;
  users: number;
}

export async function seedDatabase(options: { now?: Date; log?: Log; passwordHashCost?: number } = {}): Promise<SeedSummary> {
  const now = options.now ?? new Date();
  const log = options.log ?? (() => {});
  const rng = createRandom(19820);

  log("Resetting database…");
  await resetDatabase();
  const roleIds = await seedGlobals();

  log("Creating organization, scorecards and users…");
  const org = await provisionOrganization(db, { name: "Zeke AI", slug: "zeke-ai", workspaceName: "Zeke AI Workspace", createdById: null, now });
  const passwordHash = await hashPassword(SEED_PASSWORD, options.passwordHashCost ?? 10);
  const userIds = new Map<string, string>();
  const userNames = new Map<string, string>();
  for (const u of SEED_USERS) {
    const [row] = await db
      .insert(s.users)
      .values({ email: u.email, name: u.name, passwordHash: u.status === "invited" ? null : passwordHash })
      .returning({ id: s.users.id });
    userIds.set(u.key, row.id);
    userNames.set(u.key, u.name);
    await db.insert(s.memberships).values({
      organizationId: org.organizationId,
      userId: row.id,
      roleId: roleIds.get(u.role)!,
      title: u.title,
      status: u.status,
      accessScope: { segments: u.segments },
      lastActiveAt: u.status === "active" ? new Date(now.getTime() - rng.int(0, 72) * 3_600_000) : null,
      invitedById: u.status === "invited" ? null : undefined,
    });
  }
  const mayaId = userIds.get("maya")!;

  log("Connecting integrations…");
  for (const i of SEED_INTEGRATIONS.filter((x) => x.connected)) {
    await db
      .update(s.integrationConnections)
      .set({
        status: "connected",
        config: { syncFrequency: i.key === "product_telemetry" ? "hourly" : "daily" },
        lastSyncedAt: new Date(now.getTime() - rng.int(10, 300) * 60_000),
        lastSyncStatus: "Synced 36 accounts",
        connectedById: mayaId,
        connectedAt: addDays(now, -rng.int(60, 300)),
      })
      .where(and(eq(s.integrationConnections.organizationId, org.organizationId), eq(s.integrationConnections.integrationKey, i.key)));
  }

  log("Generating 36 accounts with 12 months of health history…");
  const generated = generateAccounts(rng);
  const accountIds: string[] = [];
  const metricRows: Array<typeof s.healthMetricValues.$inferInsert> = [];
  const sourceRows: Array<typeof s.healthSourceScores.$inferInsert> = [];
  const snapshotRows: Array<typeof s.healthScoreSnapshots.$inferInsert> = [];
  const periods = Array.from({ length: HISTORY }, (_, k) => monthStart(now, k - (HISTORY - 1)));

  for (const a of generated) {
    const activityRng = createRandom(hashString(`activity-${a.name}`));
    const [acc] = await db
      .insert(s.accounts)
      .values({
        organizationId: org.organizationId,
        workspaceId: org.workspaceId,
        name: a.name,
        domain: domainFor(a.name),
        industry: industryFor(a.name),
        lifecycleStageId: org.stageIds.get(a.lifecycle)!,
        segmentId: org.segmentIds.get(a.segment)!,
        ownerId: userIds.get(a.ownerKey)!,
        arr: a.arr,
        renewalDate: toIsoDate(addDays(now, a.renewalInDays)),
        nps: a.nps,
        openTickets: a.openTickets,
        licensedSeats: a.segment === "Enterprise" ? activityRng.int(300, 600) : a.segment === "Mid-Market" ? activityRng.int(60, 200) : activityRng.int(10, 45),
        lastMeetingAt: new Date(now.getTime() - a.lastMeetingDays * DAY_MS),
        lastLoginAt: new Date(now.getTime() - a.lastLoginDays * DAY_MS - activityRng.int(0, 20) * 3_600_000),
        keyRolesDocumented: a.hygieneContacts,
        keyRolesTotal: a.hygieneTotal,
        createdAt: addDays(now, -activityRng.int(200, 900)),
      })
      .returning({ id: s.accounts.id });
    accountIds.push(acc.id);

    await db.insert(s.accountOwners).values([
      { organizationId: org.organizationId, accountId: acc.id, userId: userIds.get(a.ownerKey)!, role: "csm" as const },
      ...(a.segment === "Enterprise" ? [{ organizationId: org.organizationId, accountId: acc.id, userId: userIds.get("priya")!, role: "account_manager" as const }] : []),
    ].filter((v, i, arr) => arr.findIndex((x) => x.userId === v.userId && x.role === v.role) === i));

    // Health history
    const detail = generateSourceDetail(a);
    const weights = org.weightsByKey.get(`${a.lifecycle}|${a.segment}`)!;
    for (const src of HEALTH_SOURCES) {
      const d = detail[src.key];
      periods.forEach((period, k) => {
        sourceRows.push({ organizationId: org.organizationId, accountId: acc.id, sourceKey: src.key, period, score: Math.round(d.history[k]) });
        for (const mt of d.metrics) {
          metricRows.push({ organizationId: org.organizationId, accountId: acc.id, sourceKey: src.key, metricKey: mt.metricKey, period, rawValue: mt.raws[k], score: mt.scores[k] });
        }
      });
    }
    let previousBand: string | null = null;
    for (let k = 0; k < HISTORY - 1; k++) {
      const monthly = Object.fromEntries(HEALTH_SOURCES.map((src) => [src.key, detail[src.key].history[k]]));
      const score = calculateHealthScore(monthly, weights);
      const band = getHealthBand(score);
      snapshotRows.push({ organizationId: org.organizationId, accountId: acc.id, score, band, reason: "monthly", takenAt: new Date(`${periods[k]}T06:00:00Z`) });
      if (previousBand && previousBand !== band) {
        await db.insert(s.timelineEvents).values({
          organizationId: org.organizationId,
          accountId: acc.id,
          kind: "band_changed",
          title: `Health moved from ${previousBand === "atRisk" ? "At Risk" : previousBand} to ${band === "atRisk" ? "At Risk" : band}`,
          description: `Monthly score ${score}`,
          occurredAt: new Date(`${periods[k]}T06:00:00Z`),
        });
      }
      previousBand = band;
    }

    // Contacts
    for (const [ci, c] of a.contacts.entries()) {
      const [contact] = await db
        .insert(s.contacts)
        .values({
          organizationId: org.organizationId,
          firstName: c.firstName,
          lastName: c.lastName,
          email: `${c.firstName}.${c.lastName}`.toLowerCase().normalize("NFD").replace(/[^a-z.]/g, "") + `@${domainFor(a.name)}`,
          title: c.role,
          phone: `+1 (555) ${String(100 + activityRng.int(0, 899))}-${String(1000 + activityRng.int(0, 8999))}`,
        })
        .returning({ id: s.contacts.id });
      await db.insert(s.accountContacts).values({
        organizationId: org.organizationId,
        accountId: acc.id,
        contactId: contact.id,
        role: c.role,
        isChampion: c.champion,
        isPrimary: ci === 0,
        status: c.status,
        lastEngagedAt: new Date(now.getTime() - c.lastEngagedDays * DAY_MS),
      });
    }

    // Notes
    if (a.notes.length) {
      await db.insert(s.notes).values(
        a.notes.map((n) => {
          const at = new Date(now.getTime() - n.daysAgo * DAY_MS);
          return { organizationId: org.organizationId, accountId: acc.id, authorId: userIds.get(n.ownerKey)!, body: n.text, createdAt: at, updatedAt: at };
        }),
      );
    }

    // Activities
    const acts: Array<typeof s.activities.$inferInsert> = [];
    const meetingCount = activityRng.int(2, 4);
    for (let m = 0; m < meetingCount; m++) {
      const daysAgo = a.lastMeetingDays + m * activityRng.int(18, 40);
      acts.push({ organizationId: org.organizationId, accountId: acc.id, userId: userIds.get(a.ownerKey)!, type: "meeting", subject: activityRng.pick(MEETING_SUBJECTS), occurredAt: new Date(now.getTime() - daysAgo * DAY_MS) });
    }
    for (let t = 0; t < a.openTickets; t++) {
      acts.push({ organizationId: org.organizationId, accountId: acc.id, type: "ticket", subject: activityRng.pick(TICKET_SUBJECTS), body: "Open", occurredAt: new Date(now.getTime() - activityRng.int(1, 30) * DAY_MS) });
    }
    const emailCount = activityRng.int(1, 3);
    for (let e = 0; e < emailCount; e++) {
      acts.push({ organizationId: org.organizationId, accountId: acc.id, userId: userIds.get(a.ownerKey)!, type: "email", subject: activityRng.pick(EMAIL_SUBJECTS), occurredAt: new Date(now.getTime() - activityRng.int(1, 60) * DAY_MS) });
    }
    if (activityRng.chance(0.5)) {
      acts.push({ organizationId: org.organizationId, accountId: acc.id, type: "survey", subject: `NPS response: ${a.nps >= 50 ? 9 : a.nps >= 0 ? 7 : 4}/10`, occurredAt: new Date(now.getTime() - activityRng.int(5, 80) * DAY_MS) });
    }
    await db.insert(s.activities).values(acts);
    const lastActivity = acts.reduce((max, x) => (x.occurredAt.getTime() > max ? x.occurredAt.getTime() : max), 0);
    await db.update(s.accounts).set({ lastActivityAt: new Date(lastActivity) }).where(eq(s.accounts.id, acc.id));

    await db.insert(s.timelineEvents).values({
      organizationId: org.organizationId,
      accountId: acc.id,
      kind: "account_created",
      title: "Account created",
      description: `Synced from Salesforce CRM · ${a.segment}`,
      occurredAt: addDays(now, -400),
    });

    // Opportunities
    const opps: Array<typeof s.opportunities.$inferInsert> = [];
    if (a.renewalInDays <= 200) {
      opps.push({
        organizationId: org.organizationId,
        accountId: acc.id,
        ownerId: userIds.get(a.segment === "Enterprise" ? "priya" : a.ownerKey)!,
        name: `${a.name} — Renewal FY${now.getUTCFullYear() + 1}`,
        type: "renewal",
        stage: a.renewalInDays < 60 ? "negotiation" : a.renewalInDays < 120 ? "proposal" : "qualification",
        amount: a.arr,
        closeDate: toIsoDate(addDays(now, a.renewalInDays)),
      });
    }
    if (a.lifecycle === "Growth" || a.nps >= 50) {
      opps.push({
        organizationId: org.organizationId,
        accountId: acc.id,
        ownerId: userIds.get(a.ownerKey)!,
        name: `${a.name} — Seat expansion`,
        type: "expansion",
        stage: activityRng.pick(["discovery", "qualification", "proposal"] as const),
        amount: Math.round((a.arr * activityRng.int(10, 25)) / 100 / 1000) * 1000,
        closeDate: toIsoDate(addDays(now, activityRng.int(30, 150))),
      });
    }
    if (activityRng.chance(0.15)) {
      opps.push({ organizationId: org.organizationId, accountId: acc.id, ownerId: userIds.get(a.ownerKey)!, name: `${a.name} — Add-on module`, type: "expansion", stage: "closed_won", amount: Math.round((a.arr * 0.08) / 1000) * 1000, closeDate: toIsoDate(addDays(now, -activityRng.int(20, 120))) });
    }
    if (opps.length) await db.insert(s.opportunities).values(opps);
  }

  await insertInChunks(sourceRows, (chunk) => db.insert(s.healthSourceScores).values(chunk));
  await insertInChunks(metricRows, (chunk) => db.insert(s.healthMetricValues).values(chunk), 2000);
  await insertInChunks(snapshotRows, (chunk) => db.insert(s.healthScoreSnapshots).values(chunk));

  log("Calculating health scores…");
  await recalculateHealthScores(db, org.organizationId, { reason: "seed", now });

  const agentIds = org.agentIds;
  await db.update(s.agents).set({ createdById: mayaId, createdAt: addDays(now, -240) }).where(eq(s.agents.organizationId, org.organizationId));

  log("Creating audiences…");
  const audiences: Array<{ name: string; description: string; type: "dynamic" | "static"; filter: AudienceFilter }> = [
    {
      name: "Enterprise · At Risk · Adoption",
      description: "Large Adoption-stage accounts that have slipped into At Risk.",
      type: "dynamic",
      filter: {
        combinator: "or",
        groups: [
          {
            id: "g1",
            combinator: "and",
            conditions: [
              { id: "c1", field: "segment", operator: "equals", value: "Enterprise" },
              { id: "c2", field: "lifecycle", operator: "equals", value: "Adoption" },
              { id: "c3", field: "band", operator: "equals", value: "atRisk" },
            ],
            groups: [],
          },
        ],
      },
    },
    {
      name: "Renewals in next 90 days OR already critical",
      description: "Everything that needs commercial attention this quarter.",
      type: "dynamic",
      filter: {
        combinator: "or",
        groups: [
          { id: "g1", combinator: "and", conditions: [{ id: "c1", field: "renewalInDays", operator: "lessThan", value: 90 }], groups: [] },
          { id: "g2", combinator: "and", conditions: [{ id: "c2", field: "band", operator: "equals", value: "critical" }], groups: [] },
        ],
      },
    },
    {
      name: "Stale engagement — no meeting in 45 days",
      description: "Accounts we haven't met with recently, excluding Thriving.",
      type: "dynamic",
      filter: {
        combinator: "or",
        groups: [
          {
            id: "g1",
            combinator: "and",
            conditions: [
              { id: "c1", field: "lastMeetingDays", operator: "greaterThan", value: 45 },
              { id: "c2", field: "band", operator: "notEquals", value: "thriving" },
            ],
            groups: [],
          },
        ],
      },
    },
  ];
  for (const aud of audiences) {
    await saveAudienceTree(db, { organizationId: org.organizationId, createdById: mayaId, name: aud.name, description: aud.description, type: aud.type, filter: aud.filter });
  }
  // A static snapshot frozen to today's critical accounts.
  const critical = await db
    .select({ accountId: s.healthScores.accountId })
    .from(s.healthScores)
    .where(sql`${s.healthScores.organizationId} = ${org.organizationId} and ${s.healthScores.band} = 'critical'`);
  const snapshot = await saveAudienceTree(db, {
    organizationId: org.organizationId,
    createdById: mayaId,
    name: "Q3 escalation watchlist (snapshot)",
    description: "Frozen list of accounts that were Critical when the quarter started.",
    type: "static",
    filter: { combinator: "or", groups: [{ id: "g1", combinator: "and", conditions: [{ id: "c1", field: "band", operator: "equals", value: "critical" }], groups: [] }] },
  });
  if (critical.length) {
    await db.insert(s.audienceMemberships).values(critical.map((c) => ({ organizationId: org.organizationId, audienceId: snapshot, accountId: c.accountId, addedAt: addDays(now, -20) })));
  }

  log("Seeding historical agent runs…");
  const currentScores = await db
    .select({ accountId: s.healthScores.accountId, score: s.healthScores.score })
    .from(s.healthScores)
    .where(eq(s.healthScores.organizationId, org.organizationId));
  const scoreByAccount = new Map(currentScores.map((r) => [r.accountId, r.score]));
  const historyRng = createRandom(4242);
  for (const agent of AGENT_TEMPLATES) {
    const agentId = agentIds.get(agent.key)!;
    const [agentRow] = await db.select({ versionId: s.agents.currentVersionId }).from(s.agents).where(eq(s.agents.id, agentId));
    const runCount = historyRng.int(4, 9);
    for (let i = 0; i < runCount; i++) {
      const idx = historyRng.int(0, generated.length - 1);
      const a = generated[idx];
      const accountId = accountIds[idx];
      const metricNow = a.sources[agent.targetMetric];
      const lift = historyRng.int(-6, 24);
      const metricAtLaunch = clamp(metricNow - lift, 4, 96);
      const weights = org.weightsByKey.get(`${a.lifecycle}|${a.segment}`)!;
      const scoreLift = Math.round(lift * (weights[agent.targetMetric] / 100));
      const startedDaysAgo = historyRng.int(30, 170);
      const durationDays = historyRng.int(3, Math.min(startedDaysAgo - agent.cooldownDays > 3 ? startedDaysAgo - agent.cooldownDays : 4, 30));
      const startedAt = addDays(now, -startedDaysAgo);
      const completedAt = addDays(startedAt, durationDays);
      const [run] = await db
        .insert(s.agentRuns)
        .values({
          organizationId: org.organizationId,
          agentId,
          agentVersionId: agentRow.versionId!,
          accountId,
          ownerId: userIds.get(a.ownerKey)!,
          sourceLabel: "Historical",
          status: "completed",
          outcome: lift >= 8 ? "resolved" : lift > 0 ? "improved" : "no_change",
          targetMetric: agent.targetMetric,
          metricAtLaunch,
          scoreAtLaunch: clamp((scoreByAccount.get(accountId) ?? 50) - scoreLift, 5, 99),
          launchedById: mayaId,
          startedAt,
          completedAt,
        })
        .returning({ id: s.agentRuns.id });
      await db.insert(s.agentRunSteps).values(
        agent.steps.map((step, position) => ({
          organizationId: org.organizationId,
          runId: run.id,
          position,
          type: step.type,
          config: step.config,
          status: "completed" as const,
          branchTaken: step.type === "condition" ? historyRng.pick(["yes", "no"] as const) : null,
          startedAt: addDays(startedAt, (durationDays * position) / agent.steps.length),
          completedAt: addDays(startedAt, (durationDays * (position + 1)) / agent.steps.length),
        })),
      );
    }
  }

  log("Launching active agent runs through the orchestration engine…");
  const mayaCtx: ServiceContext = {
    organizationId: org.organizationId,
    userId: mayaId,
    userName: "Maya Chen",
    role: "admin",
    permissions: ROLE_PERMISSIONS.admin,
    segmentScope: [],
  };
  const bandOf = new Map(
    (await db.select({ accountId: s.healthScores.accountId, band: s.healthScores.band }).from(s.healthScores).where(eq(s.healthScores.organizationId, org.organizationId))).map((r) => [r.accountId, r.band]),
  );
  const pick = (filter: (a: GeneratedAccount, id: string) => boolean, n: number) => generated.map((a, i) => ({ a, id: accountIds[i] })).filter(({ a, id }) => filter(a, id)).slice(0, n).map((x) => x.id);
  const launches: Array<[string, string[], string]> = [
    ["adoption-risk", pick((a, id) => a.lifecycle === "Adoption" && bandOf.get(id) !== "thriving", 3), "Adoption Risk audience"],
    ["handover", pick((a) => a.lifecycle === "Onboarding", 2), "Onboarding cohort"],
    ["renewal", pick((a) => a.renewalInDays <= 120, 3), "Renewals in next 120 days"],
    ["red-account-review", pick((a, id) => a.lifecycle === "Growth" && bandOf.get(id) !== "thriving", 2), "Red Account Review"],
  ];
  const launchedRunIds: string[] = [];
  for (const [key, ids, label] of launches) {
    if (ids.length === 0) continue;
    const result = await launchAgent(mayaCtx, { agentId: agentIds.get(key)!, accountIds: ids, sourceLabel: label }, { now: addDays(now, -3) });
    launchedRunIds.push(...result.launched.map((l) => l.runId));
  }
  // Advance every other run past its first task so the queue has a realistic mix of step types.
  for (const [i, runId] of launchedRunIds.entries()) {
    if (i % 2 !== 0) continue;
    const steps = await listRunSteps(db, runId);
    const active = steps.find((st) => st.status === "active");
    if (active && active.type === "task") {
      await db.transaction(async (tx) => {
        await tx.update(s.workItems).set({ status: "completed", completedAt: addDays(now, -2), completedById: mayaId, resolution: "Completed" }).where(eq(s.workItems.agentRunStepId, active.id));
        await resolveRunStep(tx, mayaCtx, runId, active.id, { kind: "complete" }, addDays(now, -2));
      });
    }
  }

  log("Creating manual work items, notifications, audit history…");
  const manual: Array<{ idx: number; owner: string; type: (typeof s.workItems.$inferInsert)["type"]; title: string; priority: "low" | "medium" | "high"; due: number }> = [
    { idx: 0, owner: "maya", type: "call", title: "Call exec sponsor about expansion into second department", priority: "high", due: 0 },
    { idx: 4, owner: "maya", type: "follow_up", title: "Send QBR recap and agreed action items", priority: "medium", due: -2 },
    { idx: 9, owner: "maya", type: "review", title: "Review health drivers before renewal prep", priority: "medium", due: 3 },
    { idx: 13, owner: "diego", type: "email", title: "Share admin training recording", priority: "low", due: 1 },
    { idx: 21, owner: "priya", type: "call", title: "Discuss SSO rollout blockers with IT admin", priority: "high", due: -1 },
    { idx: 30, owner: "sam", type: "task", title: "Update stakeholder map after reorg", priority: "medium", due: 5 },
    { idx: 33, owner: "jordan", type: "follow_up", title: "Confirm procurement contact for renewal paperwork", priority: "high", due: 2 },
    { idx: 18, owner: "maya", type: "task", title: "Prepare one-pager on latest release for exec sponsor", priority: "low", due: 7 },
  ];
  for (const m of manual) {
    await db.insert(s.workItems).values({
      organizationId: org.organizationId,
      accountId: accountIds[m.idx],
      ownerId: userIds.get(m.owner)!,
      type: m.type,
      title: m.title,
      priority: m.priority,
      source: "manual",
      dueAt: addDays(now, m.due),
      createdById: mayaId,
      createdAt: addDays(now, -4),
    });
  }
  await db.insert(s.notifications).values([
    { organizationId: org.organizationId, userId: mayaId, type: "health.band_changed", title: "Cascade Biotech dropped to Critical", body: "Support friction is the largest drag on the score.", href: `/accounts/${accountIds[11]}`, createdAt: addDays(now, -1) },
    { organizationId: org.organizationId, userId: mayaId, type: "work.assigned", title: "New approval waiting", body: "Executive check-in email needs your approval.", href: "/my-work", createdAt: addDays(now, -2) },
    { organizationId: org.organizationId, userId: mayaId, type: "integration.synced", title: "Salesforce sync completed", body: "36 accounts updated.", href: "/admin/integrations", readAt: addDays(now, -2), createdAt: addDays(now, -3) },
  ]);

  const auditSeed: Array<[number, string, string, string, string]> = [
    [40, "maya", "scorecard.updated", "scorecard", "Adoption · Enterprise weighting reviewed — no changes"],
    [33, "alex", "integration.connected", "integration", "Outlook 365 connected"],
    [28, "maya", "user.invited", "user", "Invited Casey Morgan as CSM (SMB)"],
    [21, "priya", "audience.created", "audience", "Enterprise · At Risk · Adoption — 2 accounts (live)"],
    [14, "maya", "agent.updated", "agent", "Renewal CTA — added automatic at-risk branch"],
    [9, "alex", "settings.updated", "workspace", "CSM alert threshold changed to 55"],
    [5, "diego", "note.created", "account", "Added note on Bluepeak Telecom"],
  ];
  await db.insert(s.auditLogs).values(
    auditSeed.map(([days, user, action, entityType, summary]) => ({
      organizationId: org.organizationId,
      actorId: userIds.get(user)!,
      actorName: userNames.get(user)!,
      action,
      entityType,
      summary,
      ipAddress: "10.0.4.12",
      userAgent: "Mozilla/5.0 (Macintosh)",
      createdAt: addDays(now, -days),
    })),
  );

  log("Seeding user activity analytics…");
  const usageRng = createRandom(777);
  const usage: Array<typeof s.userActivityEvents.$inferInsert> = [];
  for (const u of SEED_USERS) {
    const count = u.status === "active" ? usageRng.int(60, 160) : 0;
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.pow(usageRng.next(), 1.6) * 180);
      usage.push({
        organizationId: org.organizationId,
        userId: userIds.get(u.key)!,
        type: usageRng.pick(USER_ACTIVITY_TYPES),
        accountId: usageRng.pick(accountIds),
        occurredAt: new Date(now.getTime() - daysAgo * DAY_MS - usageRng.int(0, 86_000) * 1000),
      });
    }
  }
  await insertInChunks(usage, (chunk) => db.insert(s.userActivityEvents).values(chunk));

  log("Creating a second tenant (isolation check)…");
  await seedSecondTenant(roleIds, passwordHash, now);

  return { organizationId: org.organizationId, accounts: generated.length, users: SEED_USERS.length };
}

async function seedSecondTenant(roleIds: Map<RoleKey, string>, passwordHash: string, now: Date) {
  const org = await provisionOrganization(db, { name: "Northstar Analytics", slug: "northstar", workspaceName: "Northstar Workspace", createdById: null, now });
  const [user] = await db.insert(s.users).values({ email: "elena.petrova@northstar.dev", name: "Elena Petrova", passwordHash }).returning({ id: s.users.id });
  await db.insert(s.memberships).values({ organizationId: org.organizationId, userId: user.id, roleId: roleIds.get("owner")!, title: "Head of CS", status: "active" });
  const rng = createRandom(99);
  const names: Array<[string, LifecycleStageName, string]> = [
    ["Aurora Dynamics", "Adoption", "Enterprise"],
    ["Basalt Robotics", "Growth", "Mid-Market"],
    ["Crescent Foods", "Renewal", "SMB"],
    ["Delta Ridge Clinics", "Onboarding", "Mid-Market"],
  ];
  const period = monthStart(now);
  for (const [name, lifecycle, segment] of names) {
    const [acc] = await db
      .insert(s.accounts)
      .values({
        organizationId: org.organizationId,
        workspaceId: org.workspaceId,
        name,
        domain: domainFor(name),
        lifecycleStageId: org.stageIds.get(lifecycle)!,
        segmentId: org.segmentIds.get(segment)!,
        ownerId: user.id,
        arr: rng.int(...ARR_RANGE[segment]),
        renewalDate: toIsoDate(addDays(now, rng.int(30, 300))),
        nps: rng.int(-20, 70),
        openTickets: rng.int(0, 4),
        lastMeetingAt: addDays(now, -rng.int(2, 40)),
        lastLoginAt: addDays(now, -rng.int(0, 10)),
      })
      .returning({ id: s.accounts.id });
    await db.insert(s.healthSourceScores).values(HEALTH_SOURCES.map((src) => ({ organizationId: org.organizationId, accountId: acc.id, sourceKey: src.key, period, score: rng.int(30, 95) })));
  }
  await recalculateHealthScores(db, org.organizationId, { reason: "seed", now });
}
