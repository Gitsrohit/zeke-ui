import { foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AudienceConditionValue } from "@/features/audiences/domain/types";
import { accounts } from "./crm";
import { organizations, users } from "./tenancy";

export const audienceTypeEnum = pgEnum("audience_type", ["dynamic", "static"]);
export const combinatorEnum = pgEnum("audience_combinator", ["and", "or"]);

export const audiences = pgTable(
  "audiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: audienceTypeEnum("type").notNull().default("dynamic"),
    /** Combinator applied between the root groups. */
    rootCombinator: combinatorEnum("root_combinator").notNull().default("or"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    lastMemberCount: integer("last_member_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audiences_org_idx").on(t.organizationId)],
);

/** Groups nest via parent_group_id; a null parent means a root group. */
export const audienceGroups = pgTable(
  "audience_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    audienceId: uuid("audience_id")
      .notNull()
      .references(() => audiences.id, { onDelete: "cascade" }),
    parentGroupId: uuid("parent_group_id"),
    combinator: combinatorEnum("combinator").notNull().default("and"),
    position: integer("position").notNull(),
  },
  (t) => [
    index("audience_groups_audience_idx").on(t.audienceId),
    foreignKey({ columns: [t.parentGroupId], foreignColumns: [t.id], name: "audience_groups_parent_fk" }).onDelete("cascade"),
  ],
);

export const audienceConditions = pgTable(
  "audience_conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => audienceGroups.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    operator: text("operator").notNull(),
    value: jsonb("value").$type<AudienceConditionValue>().notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("audience_conditions_group_idx").on(t.groupId)],
);

/** Frozen membership for static snapshots. Dynamic audiences are evaluated live. */
export const audienceMemberships = pgTable(
  "audience_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    audienceId: uuid("audience_id")
      .notNull()
      .references(() => audiences.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("audience_membership_unique").on(t.audienceId, t.accountId)],
);
