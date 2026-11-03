import { sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { user } from "./auth.ts"
import { createdAt } from "./columns.ts"

export const developer = sqliteTable("developer", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: text("kind", { enum: ["person", "organisation"] }).notNull(),
  githubLogin: text("github_login"),
  agreementVersion: text("agreement_version").notNull(),
  agreementAt: integer("agreement_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
  createdAt: createdAt(),
})

export const namespace = sqliteTable(
  "namespace",
  {
    prefix: text("prefix").primaryKey(),
    developerId: text("developer_id")
      .notNull()
      .references(() => developer.id, { onDelete: "cascade" }),
    proof: text("proof", { enum: ["dns", "well-known", "github", "manual"] }),
    proofValue: text("proof_value").notNull(),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("namespace_developer").on(table.developerId)],
)

export const app = sqliteTable(
  "app",
  {
    id: text("id").primaryKey(),
    developerId: text("developer_id")
      .notNull()
      .references(() => developer.id, { onDelete: "cascade" }),
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
    index("app_developer").on(table.developerId),
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
    developerId: text("developer_id")
      .notNull()
      .references(() => developer.id, { onDelete: "cascade" }),
    hash: text("hash").notNull().unique(),
    name: text("name").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("token_app").on(table.appId)],
)
