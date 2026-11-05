import { env } from "cloudflare:workers"
import { getTableColumns } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import type { SQLiteTable } from "drizzle-orm/sqlite-core"
import * as schema from "./schema/index.ts"

const D1_PARAMETERS_PER_STATEMENT = 100

export const db = drizzle(env.DB, { schema })
export { schema }

export function insertRows<T extends SQLiteTable>(table: T, rows: T["$inferInsert"][]) {
  const size = Math.floor(D1_PARAMETERS_PER_STATEMENT / Object.keys(getTableColumns(table)).length)
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    db.insert(table).values(rows.slice(index * size, (index + 1) * size)),
  )
}
