import { FORMATS, UPDATERS, VISIBILITIES } from "@schelf/protocol"
import { sql } from "drizzle-orm"
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { createdAt } from "./columns.ts"
import { publisher } from "./publishers.ts"

export const namespace = sqliteTable(
  "namespace",
  {
    prefix: text("prefix").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publisher.id, { onDelete: "cascade" }),
    proof: text("proof", { enum: ["dns", "well-known", "github", "manual"] }),
    proofValue: text("proof_value").notNull(),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("namespace_publisher").on(table.publisherId)],
)

export const app = sqliteTable(
  "app",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publisher.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    kind: text("kind", { enum: ["app", "extension"] }).notNull(),
    format: text("format", { enum: FORMATS }).notNull(),
    repository: text("repository"),
    repositoryId: text("repository_id"),
    licence: text("licence"),
    distribution: text("distribution", { enum: ["open", "proprietary"] })
      .notNull()
      .default("open"),
    status: text("status", { enum: ["draft", "in-review", "published", "delisted", "pulled"] })
      .notNull()
      .default("draft"),
    visibility: text("visibility", { enum: VISIBILITIES }).notNull().default("listed"),
    pageIndexed: integer("page_indexed", { mode: "boolean" }).notNull().default(false),
    latestFollowsRollout: integer("latest_follows_rollout", { mode: "boolean" }).notNull().default(false),
    updater: text("updater", { enum: UPDATERS }),
    listingRequestedAt: integer("listing_requested_at", { mode: "timestamp_ms" }),
    listingItem: text("listing_item"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("app_id_folded").on(sql`lower(${table.id})`),
    uniqueIndex("app_slug").on(table.publisherId, table.slug),
  ],
)

export const channel = sqliteTable(
  "channel",
  {
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keep: integer("keep"),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.appId, table.name] })],
)

export const updaterSwitch = sqliteTable(
  "updater_switch",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    fromUpdater: text("from_updater", { enum: UPDATERS }).notNull(),
    toUpdater: text("to_updater", { enum: UPDATERS }).notNull(),
    fromFormat: text("from_format", { enum: FORMATS }).notNull(),
    toFormat: text("to_format", { enum: FORMATS }).notNull(),
    startedBy: text("started_by").notNull(),
    firstReleaseId: text("first_release_id"),
    bridgeReleaseId: text("bridge_release_id"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("updater_switch_app").on(table.appId)],
)

export const trustedPublisher = sqliteTable(
  "trusted_publisher",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    repositoryId: text("repository_id").notNull(),
    repository: text("repository").notNull(),
    workflow: text("workflow").notNull(),
    environment: text("environment"),
    createdAt: createdAt(),
  },
  (table) => [index("trusted_publisher_repository").on(table.repositoryId)],
)

export const token = sqliteTable(
  "token",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publisher.id, { onDelete: "cascade" }),
    hash: text("hash").notNull().unique(),
    name: text("name").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("token_app").on(table.appId)],
)
