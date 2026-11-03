import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
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
    kind: text("kind", { enum: ["app", "extension"] }).notNull(),
    format: text("format", { enum: ["sabine", "appimage", "luft-extension"] }).notNull(),
    repository: text("repository"),
    repositoryId: text("repository_id"),
    licence: text("licence"),
    distribution: text("distribution", { enum: ["open", "proprietary"] })
      .notNull()
      .default("open"),
    status: text("status", { enum: ["draft", "in-review", "listed", "delisted", "pulled"] })
      .notNull()
      .default("draft"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("app_id_folded").on(sql`lower(${table.id})`),
    index("app_publisher").on(table.publisherId),
  ],
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
