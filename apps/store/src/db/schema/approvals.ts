import type { ApprovalAction, ApprovalStep } from "@schelf/protocol"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { user } from "./auth.ts"
import { createdAt } from "./columns.ts"

export const approval = sqliteTable(
  "approval",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actions: text("actions", { mode: "json" }).$type<ApprovalAction[]>().notNull(),
    steps: text("steps", { mode: "json" }).$type<ApprovalStep[]>().notNull(),
    secrets: text("secrets", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
    passkey: integer("passkey", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["pending", "running", "done", "failed", "cancelled"] })
      .notNull()
      .default("pending"),
    host: text("host"),
    place: text("place"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("approval_user").on(table.userId, table.status)],
)
