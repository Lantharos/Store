import { PUBLISHER_KINDS, ROLES } from "@schelf/protocol"
import { sql } from "drizzle-orm"
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { user } from "./auth.ts"
import { createdAt } from "./columns.ts"

export const publisher = sqliteTable(
  "publisher",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: PUBLISHER_KINDS }).notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    website: text("website"),
    logoKey: text("logo_key"),
    agreementVersion: text("agreement_version").notNull(),
    agreementAt: integer("agreement_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("publisher_slug").on(table.slug),
    uniqueIndex("publisher_person").on(table.ownerId).where(sql`${table.kind} = 'person'`),
  ],
)

export const member = sqliteTable(
  "member",
  {
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publisher.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.publisherId, table.userId] }),
    index("member_user").on(table.userId),
  ],
)

export const invite = sqliteTable(
  "invite",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publisher.id, { onDelete: "cascade" }),
    email: text("email"),
    githubLogin: text("github_login"),
    role: text("role", { enum: ROLES }).notNull(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("invite_publisher").on(table.publisherId),
    index("invite_email").on(table.email),
    index("invite_github").on(table.githubLogin),
  ],
)
