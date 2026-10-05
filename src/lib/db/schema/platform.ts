import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { agentRunSteps, agentRuns } from "./agents";
import { accounts } from "./crm";
import { organizations, users } from "./tenancy";

export const workItemTypeEnum = pgEnum("work_item_type", [
  "task",
  "email",
  "call",
  "review",
  "approval",
  "decision",
  "follow_up",
]);
export const workItemStatusEnum = pgEnum("work_item_status", ["open", "completed", "snoozed", "cancelled"]);
export const workItemPriorityEnum = pgEnum("work_item_priority", ["low", "medium", "high"]);
export const workItemSourceEnum = pgEnum("work_item_source", ["manual", "agent", "ai"]);
export const integrationStatusEnum = pgEnum("integration_status", ["connected", "disconnected", "error"]);

export const workItems = pgTable(
  "work_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    type: workItemTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: workItemPriorityEnum("priority").notNull().default("medium"),
    status: workItemStatusEnum("status").notNull().default("open"),
    source: workItemSourceEnum("source").notNull().default("manual"),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "cascade" }),
    agentRunStepId: uuid("agent_run_step_id").references(() => agentRunSteps.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id, { onDelete: "set null" }),
    resolution: text("resolution"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("work_items_org_status_idx").on(t.organizationId, t.status, t.dueAt),
    index("work_items_owner_idx").on(t.organizationId, t.ownerId, t.status),
    index("work_items_account_idx").on(t.organizationId, t.accountId),
    index("work_items_run_idx").on(t.agentRunId),
  ],
);

/** Global integration catalogue. */
export const integrations = pgTable("integrations", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
});

export interface IntegrationConfig {
  syncFrequency: "hourly" | "daily" | "weekly";
  [key: string]: string | number | boolean;
}

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationKey: text("integration_key")
      .notNull()
      .references(() => integrations.key),
    status: integrationStatusEnum("status").notNull().default("disconnected"),
    config: jsonb("config").$type<IntegrationConfig>().notNull().default({ syncFrequency: "daily" }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status"),
    connectedById: uuid("connected_by_id").references(() => users.id, { onDelete: "set null" }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("integration_conn_unique").on(t.organizationId, t.integrationKey)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.organizationId, t.userId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_logs_entity_idx").on(t.organizationId, t.entityType, t.entityId),
  ],
);

/** A CSM dismissing an account from Drive Outcome recommendations. */
export const outcomeDismissals = pgTable(
  "outcome_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    reason: text("reason"),
    dismissedById: uuid("dismissed_by_id").references(() => users.id, { onDelete: "set null" }),
    dismissedUntil: timestamp("dismissed_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outcome_dismissals_idx").on(t.organizationId, t.accountId, t.dismissedUntil)],
);

/** Platform usage events per user — powers the admin user-activity drawer. */
export const userActivityEvents = pgTable(
  "user_activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_activity_user_idx").on(t.organizationId, t.userId, t.occurredAt)],
);
