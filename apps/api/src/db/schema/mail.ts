import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createdAt } from "./columns.ts"

export const mail = sqliteTable(
  "mail",
  {
    id: text("id").primaryKey(),
    direction: text("direction", { enum: ["in", "out"] }).notNull(),
    mailbox: text("mailbox").notNull(),
    messageId: text("message_id"),
    rawKey: text("raw_key"),
    thread: text("thread"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    acknowledge: integer("acknowledge", { mode: "boolean" }).notNull().default(false),
    pultItem: text("pult_item"),
    createdAt: createdAt(),
  },
  (table) => [
    index("mail_message").on(table.messageId),
    index("mail_item").on(table.pultItem, table.createdAt),
  ],
)
