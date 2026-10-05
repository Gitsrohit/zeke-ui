import {
  boolean,
  foreignKey,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { BandThresholds, HealthBandKey, HealthSourceKey } from "@/config/health";
import { accounts, lifecycleStages, segments } from "./crm";
import { organizations, users } from "./tenancy";

/** One scorecard per lifecycle stage × segment per organisation. */
export const scorecards = pgTable(
  "scorecards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    lifecycleStageId: uuid("lifecycle_stage_id")
      .notNull()
      .references(() => lifecycleStages.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("scorecard_org_stage_segment_unique").on(t.organizationId, t.lifecycleStageId, t.segmentId)],
);

/** Immutable versions: every change to weights or thresholds creates a new version. */
export const scorecardVersions = pgTable(
  "scorecard_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    scorecardId: uuid("scorecard_id")
      .notNull()
      .references(() => scorecards.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    formula: text("formula").notNull().default("weighted_average"),
    thresholds: jsonb("thresholds").$type<BandThresholds>().notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    changeNote: text("change_note"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("scorecard_version_unique").on(t.scorecardId, t.version),
    index("scorecard_versions_active_idx").on(t.organizationId, t.isActive),
  ],
);

export const scorecardWeights = pgTable(
  "scorecard_weights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scorecardVersionId: uuid("scorecard_version_id")
      .notNull()
      .references(() => scorecardVersions.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").$type<HealthSourceKey>().notNull(),
    weight: integer("weight").notNull(),
  },
  (t) => [uniqueIndex("scorecard_weight_unique").on(t.scorecardVersionId, t.sourceKey)],
);

/** Current health score per account (one row per account). */
export const healthScores = pgTable(
  "health_scores",
  {
    accountId: uuid("account_id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    scorecardVersionId: uuid("scorecard_version_id").references(() => scorecardVersions.id, { onDelete: "set null" }),
    score: integer("score").notNull(),
    band: text("band").$type<HealthBandKey>().notNull(),
    predictiveRisk: integer("predictive_risk").notNull(),
    /** Score change versus ~90 days ago. */
    trendDelta: integer("trend_delta").notNull().default(0),
    weakestSource: text("weakest_source").$type<HealthSourceKey>(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("health_scores_org_score_idx").on(t.organizationId, t.score),
    index("health_scores_org_band_idx").on(t.organizationId, t.band),
  ],
);

export const healthScoreSnapshots = pgTable(
  "health_score_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    scorecardVersionId: uuid("scorecard_version_id"),
    score: integer("score").notNull(),
    band: text("band").$type<HealthBandKey>().notNull(),
    reason: text("reason").notNull().default("scheduled"),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("health_snapshots_account_idx").on(t.organizationId, t.accountId, t.takenAt),
    foreignKey({ columns: [t.scorecardVersionId], foreignColumns: [scorecardVersions.id], name: "health_snapshots_version_fk" }).onDelete("set null"),
  ],
);

/** Monthly source sub-score per account (period = first day of month). */
export const healthSourceScores = pgTable(
  "health_source_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").$type<HealthSourceKey>().notNull(),
    period: date("period", { mode: "string" }).notNull(),
    score: integer("score").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("health_source_unique").on(t.accountId, t.sourceKey, t.period),
    index("health_source_org_period_idx").on(t.organizationId, t.period),
  ],
);

/** Monthly sub-metric raw value and normalised score per account. */
export const healthMetricValues = pgTable(
  "health_metric_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").$type<HealthSourceKey>().notNull(),
    metricKey: text("metric_key").notNull(),
    period: date("period", { mode: "string" }).notNull(),
    rawValue: real("raw_value").notNull(),
    score: real("score").notNull(),
  },
  (t) => [
    uniqueIndex("health_metric_unique").on(t.accountId, t.sourceKey, t.metricKey, t.period),
    index("health_metric_org_idx").on(t.organizationId, t.sourceKey, t.period),
  ],
);
