import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { HealthSourceKey } from "@/config/health";
import type { AgentStepConfig, AgentStepType } from "@/features/agents/domain/types";
import { audiences } from "./audiences";
import { accounts } from "./crm";
import { organizations, users } from "./tenancy";

export const agentStatusEnum = pgEnum("agent_status", ["active", "draft", "archived"]);
export const agentTriggerEnum = pgEnum("agent_trigger", ["manual", "audience", "event"]);
export const agentRunStatusEnum = pgEnum("agent_run_status", ["active", "completed", "stopped", "failed"]);
export const agentRunOutcomeEnum = pgEnum("agent_run_outcome", ["resolved", "improved", "no_change", "declined", "stopped"]);
export const runStepStatusEnum = pgEnum("run_step_status", ["pending", "active", "waiting", "completed", "skipped", "failed"]);
export const branchEnum = pgEnum("step_branch", ["yes", "no"]);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Stable key used by configuration (e.g. outcome recommendations). */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull(),
    status: agentStatusEnum("status").notNull().default("active"),
    triggerType: agentTriggerEnum("trigger_type").notNull().default("manual"),
    triggerLabel: text("trigger_label").notNull(),
    targetMetric: text("target_metric").$type<HealthSourceKey>().notNull(),
    audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "set null" }),
    currentVersionId: uuid("current_version_id"),
    cooldownDays: integer("cooldown_days").notNull().default(14),
    /** Maximum lifetime runs per account; null = unlimited. */
    maxAttempts: integer("max_attempts"),
    /** Lifecycle stages an account must be in; empty = all. */
    eligibleLifecycles: jsonb("eligible_lifecycles").$type<string[]>().notNull().default([]),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agents_org_key_unique").on(t.organizationId, t.key), index("agents_org_status_idx").on(t.organizationId, t.status)],
);

/** Symmetric suppression: an account active in one agent is not enrolled in a conflicting one. */
export const agentConflicts = pgTable(
  "agent_conflicts",
  {
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    conflictsWithAgentId: uuid("conflicts_with_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.conflictsWithAgentId] })],
);

export const agentVersions = pgTable(
  "agent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_version_unique").on(t.agentId, t.version)],
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentVersionId: uuid("agent_version_id")
      .notNull()
      .references(() => agentVersions.id, { onDelete: "cascade" }),
    parentStepId: uuid("parent_step_id"),
    branch: branchEnum("branch"),
    position: integer("position").notNull(),
    type: text("type").$type<AgentStepType>().notNull(),
    config: jsonb("config").$type<AgentStepConfig>().notNull(),
  },
  (t) => [
    index("agent_steps_version_idx").on(t.agentVersionId),
    foreignKey({ columns: [t.parentStepId], foreignColumns: [t.id], name: "agent_steps_parent_fk" }).onDelete("cascade"),
  ],
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    agentVersionId: uuid("agent_version_id")
      .notNull()
      .references(() => agentVersions.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    audienceId: uuid("audience_id").references(() => audiences.id, { onDelete: "set null" }),
    sourceLabel: text("source_label").notNull(),
    status: agentRunStatusEnum("status").notNull().default("active"),
    outcome: agentRunOutcomeEnum("outcome"),
    targetMetric: text("target_metric").$type<HealthSourceKey>().notNull(),
    metricAtLaunch: integer("metric_at_launch").notNull(),
    scoreAtLaunch: integer("score_at_launch").notNull(),
    launchedById: uuid("launched_by_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    stoppedReason: text("stopped_reason"),
  },
  (t) => [
    index("agent_runs_org_status_idx").on(t.organizationId, t.status),
    index("agent_runs_account_idx").on(t.organizationId, t.accountId, t.status),
    index("agent_runs_agent_idx").on(t.organizationId, t.agentId, t.startedAt),
  ],
);

/** Materialised steps for a run. Branch steps are inserted when a condition resolves. */
export const agentRunSteps = pgTable(
  "agent_run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    agentStepId: uuid("agent_step_id"),
    position: integer("position").notNull(),
    type: text("type").$type<AgentStepType>().notNull(),
    config: jsonb("config").$type<AgentStepConfig>().notNull(),
    status: runStepStatusEnum("status").notNull().default("pending"),
    branchTaken: branchEnum("branch_taken"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("agent_run_steps_run_idx").on(t.runId, t.position),
    index("agent_run_steps_waiting_idx").on(t.status, t.dueAt),
  ],
);

/** Record of every automated action the engine performed (email send, API call…). */
export const agentExecutions = pgTable(
  "agent_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    runStepId: uuid("run_step_id")
      .notNull()
      .references(() => agentRunSteps.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    status: text("status").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_executions_run_idx").on(t.runId)],
);
