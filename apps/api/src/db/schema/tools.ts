import { sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createdAt } from "./columns.ts"
import { publisher } from "./publishers.ts"

export const toolName = sqliteTable("tool_name", {
  name: text("name").primaryKey(),
  publisherId: text("publisher_id")
    .notNull()
    .references(() => publisher.id, { onDelete: "cascade" }),
  claimedBy: text("claimed_by").notNull(),
  createdAt: createdAt(),
})
