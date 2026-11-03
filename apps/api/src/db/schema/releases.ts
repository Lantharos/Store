import type { CheckName, CheckStatus, ExtensionAccess, Permissions, Requires } from "@schelf/protocol"
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { app } from "./apps.ts"
import { createdAt } from "./columns.ts"

export const release = sqliteTable(
  "release",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    channel: text("channel").notNull().default("stable"),
    tag: text("tag"),
    commit: text("commit"),
    runUrl: text("run_url"),
    workflow: text("workflow"),
    origin: text("origin", { enum: ["oidc", "token"] }).notNull(),
    notes: text("notes").notNull().default(""),
    manifest: text("manifest").notNull(),
    permissions: text("permissions", { mode: "json" }).$type<Permissions | null>(),
    extensionAccess: text("extension_access", { mode: "json" }).$type<ExtensionAccess | null>(),
    permissionsWidened: integer("permissions_widened", { mode: "boolean" }).notNull().default(false),
    requires: text("requires", { mode: "json" }).$type<Requires>().notNull(),
    status: text("status", {
      enum: [
        "uploading",
        "checking",
        "failed",
        "in-review",
        "changes-requested",
        "rejected",
        "rolling-out",
        "live",
        "withdrawn",
        "pulled",
      ],
    }).notNull(),
    rolloutPercent: integer("rollout_percent").notNull().default(0),
    rolloutPaused: integer("rollout_paused", { mode: "boolean" }).notNull().default(false),
    rolloutSteppedAt: integer("rollout_stepped_at", { mode: "timestamp_ms" }),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("release_version").on(table.appId, table.channel, table.version),
    index("release_status").on(table.status),
  ],
)

export const artifact = sqliteTable(
  "artifact",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    platform: text("platform").notNull(),
    format: text("format").notNull(),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    executable: text("executable"),
    uploadId: text("upload_id"),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }),
    attestationUrl: text("attestation_url"),
  },
  (table) => [uniqueIndex("artifact_name").on(table.releaseId, table.name)],
)

export const delta = sqliteTable("delta", {
  id: text("id").primaryKey(),
  artifactId: text("artifact_id")
    .notNull()
    .references(() => artifact.id, { onDelete: "cascade" }),
  fromReleaseId: text("from_release_id")
    .notNull()
    .references(() => release.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
})

export const check = sqliteTable(
  "check",
  {
    releaseId: text("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    name: text("name").$type<CheckName>().notNull(),
    status: text("status").$type<CheckStatus>().notNull(),
    summary: text("summary").notNull(),
    detailKey: text("detail_key"),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.releaseId, table.name] })],
)

export const countDaily = sqliteTable(
  "count_daily",
  {
    appId: text("app_id").notNull(),
    version: text("version").notNull(),
    platform: text("platform").notNull(),
    day: text("day").notNull(),
    installs: integer("installs").notNull(),
    updates: integer("updates").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.appId, table.version, table.platform, table.day] }),
    index("count_daily_day").on(table.day),
  ],
)

export const uploadPart = sqliteTable(
  "upload_part",
  {
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifact.id, { onDelete: "cascade" }),
    part: integer("part").notNull(),
    etag: text("etag").notNull(),
  },
  (table) => [primaryKey({ columns: [table.artifactId, table.part] })],
)
