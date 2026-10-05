import {
  boolean,
  index,
  integer,
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users, workspaces } from "./tenancy";

export const accountStatusEnum = pgEnum("account_status", ["active", "churned"]);
export const accountOwnerRoleEnum = pgEnum("account_owner_role", ["csm", "account_manager", "executive_sponsor"]);
export const contactStatusEnum = pgEnum("contact_status", ["active", "new", "quiet"]);
export const opportunityStageEnum = pgEnum("opportunity_stage", [
  "discovery",
  "qualification",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
]);
export const opportunityTypeEnum = pgEnum("opportunity_type", ["expansion", "renewal", "new_business"]);
export const activityTypeEnum = pgEnum("activity_type", ["meeting", "email", "call", "ticket", "login", "survey"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const lifecycleStages = pgTable(
  "lifecycle_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("lifecycle_org_name_unique").on(t.organizationId, t.name)],
);

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("segment_org_name_unique").on(t.organizationId, t.name)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    status: accountStatusEnum("status").notNull().default("active"),
    lifecycleStageId: uuid("lifecycle_stage_id")
      .notNull()
      .references(() => lifecycleStages.id),
    segmentId: uuid("segment_id")
      .notNull()
      .references(() => segments.id),
    /** Primary CSM. Additional owners live in account_owners. */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    arr: integer("arr").notNull().default(0),
    renewalDate: date("renewal_date", { mode: "string" }),
    nps: integer("nps"),
    openTickets: integer("open_tickets").notNull().default(0),
    licensedSeats: integer("licensed_seats"),
    lastMeetingAt: timestamp("last_meeting_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    keyRolesDocumented: integer("key_roles_documented").notNull().default(0),
    keyRolesTotal: integer("key_roles_total").notNull().default(10),
    ...timestamps,
  },
  (t) => [
    index("accounts_org_idx").on(t.organizationId),
    index("accounts_org_owner_idx").on(t.organizationId, t.ownerId),
    index("accounts_org_lifecycle_idx").on(t.organizationId, t.lifecycleStageId),
    index("accounts_org_segment_idx").on(t.organizationId, t.segmentId),
    index("accounts_org_arr_idx").on(t.organizationId, t.arr),
    index("accounts_org_renewal_idx").on(t.organizationId, t.renewalDate),
    index("accounts_org_name_idx").on(t.organizationId, t.name),
  ],
);

export const accountOwners = pgTable(
  "account_owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: accountOwnerRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_owner_unique").on(t.accountId, t.userId, t.role),
    index("account_owners_user_idx").on(t.organizationId, t.userId),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    title: text("title"),
    ...timestamps,
  },
  (t) => [index("contacts_org_idx").on(t.organizationId), index("contacts_org_email_idx").on(t.organizationId, t.email)],
);

export const accountContacts = pgTable(
  "account_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: text("role"),
    isChampion: boolean("is_champion").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: contactStatusEnum("status").notNull().default("active"),
    lastEngagedAt: timestamp("last_engaged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_contact_unique").on(t.accountId, t.contactId),
    index("account_contacts_account_idx").on(t.organizationId, t.accountId),
  ],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    type: opportunityTypeEnum("type").notNull(),
    stage: opportunityStageEnum("stage").notNull().default("discovery"),
    amount: integer("amount").notNull().default(0),
    closeDate: date("close_date", { mode: "string" }),
    ...timestamps,
  },
  (t) => [index("opportunities_account_idx").on(t.organizationId, t.accountId), index("opportunities_org_stage_idx").on(t.organizationId, t.stage)],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    type: activityTypeEnum("type").notNull(),
    subject: text("subject").notNull(),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activities_account_idx").on(t.organizationId, t.accountId, t.occurredAt)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("notes_account_idx").on(t.organizationId, t.accountId, t.createdAt)],
);

export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("timeline_account_idx").on(t.organizationId, t.accountId, t.occurredAt)],
);
