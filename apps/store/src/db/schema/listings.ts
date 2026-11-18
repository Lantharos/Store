import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { app } from "./apps.ts"

export const listing = sqliteTable(
  "listing",
  {
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull().default(""),
    keywords: text("keywords", { mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (table) => [primaryKey({ columns: [table.appId, table.locale] })],
)

export const listingMeta = sqliteTable("listing_meta", {
  appId: text("app_id")
    .primaryKey()
    .references(() => app.id, { onDelete: "cascade" }),
  iconKey: text("icon_key"),
  categories: text("categories", { mode: "json" }).$type<string[]>().notNull().default([]),
  homepage: text("homepage"),
  support: text("support"),
  privacyUrl: text("privacy_url"),
  contentRating: text("content_rating"),
  brandColor: text("brand_color"),
})

export const screenshot = sqliteTable(
  "screenshot",
  {
    id: text("id").primaryKey(),
    appId: text("app_id")
      .notNull()
      .references(() => app.id, { onDelete: "cascade" }),
    platform: text("platform"),
    position: integer("position").notNull(),
    key: text("key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    caption: text("caption"),
  },
  (table) => [index("screenshot_app").on(table.appId, table.position)],
)

export const mirrorApp = sqliteTable(
  "mirror_app",
  {
    id: text("id").notNull(),
    origin: text("origin", { enum: ["flathub", "fedora"] }).notNull(),
    ref: text("ref").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    icon: text("icon"),
    categories: text("categories", { mode: "json" }).$type<string[]>().notNull(),
    publisher: text("developer").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull(),
    installs30d: integer("installs_30d").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    hiddenReason: text("hidden_reason"),
    rank: real("rank").notNull(),
  },
  (table) => [primaryKey({ columns: [table.origin, table.id] })],
)
