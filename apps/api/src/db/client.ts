import { env } from "cloudflare:workers"
import { getTableColumns, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core"
import * as schema from "./schema/index.ts"

const D1_PARAMETERS_PER_STATEMENT = 100

export const db = drizzle(env.DB, { schema })
export { schema }

/** `column IN values` as one bound parameter, however many values there are. */
export function among(column: SQLiteColumn, values: string[]) {
  return sql`${column} in (select value from json_each(${JSON.stringify(values)}))`
}

export function insertRows<T extends SQLiteTable>(table: T, rows: T["$inferInsert"][]) {
  const size = Math.floor(D1_PARAMETERS_PER_STATEMENT / Object.keys(getTableColumns(table)).length)
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    db.insert(table).values(rows.slice(index * size, (index + 1) * size)),
  )
}
