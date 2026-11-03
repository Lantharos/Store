import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createdAt } from "./columns.ts"
import { app } from "./developers.ts"
import { release } from "./releases.ts"

export const review = sqliteTable(
  "review",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    pultItem: text("pult_item"),
    kind: text("kind", { enum: ["submission", "update"] }).notNull(),
    decision: text("decision", { enum: ["approved", "changes-requested", "rejected"] }),
    decidedBy: text("decided_by"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (table) => [index("review_release").on(table.releaseId)],
)

export const block = sqliteTable(
  "block",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    releaseId: text("release_id").references(() => release.id, { onDelete: "cascade" }),
    action: text("action", { enum: ["block", "warn"] }).notNull(),
    reason: text("reason").notNull(),
    publicNote: text("public_note"),
    createdAt: createdAt(),
    liftedAt: integer("lifted_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("block_app").on(table.appId)],
)

export const report = sqliteTable("report", {
  id: text("id").primaryKey(),
  appId: text("app_id").notNull(),
  kind: text("kind", { enum: ["dsa", "dmca", "abuse", "security"] }).notNull(),
  reporterEmail: text("reporter_email"),
  details: text("details").notNull(),
  pultItem: text("pult_item"),
  status: text("status", { enum: ["open", "actioned", "dismissed"] })
    .notNull()
    .default("open"),
  createdAt: createdAt(),
})

export const storeState = sqliteTable("store_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

export const signingKey = sqliteTable("signing_key", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  sealedSeed: text("sealed_seed").notNull(),
  createdAt: createdAt(),
})
