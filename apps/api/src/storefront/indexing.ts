import { DEFAULT_LOCALE } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { indexStatements, storeKey, unindexStatement } from "./search-index.ts"

export async function reindexApp(id: string) {
  const [row] = await db
    .select({
      status: schema.app.status,
      name: schema.listing.name,
      summary: schema.listing.summary,
      keywords: schema.listing.keywords,
      developer: schema.developer.name,
    })
    .from(schema.app)
    .innerJoin(schema.developer, eq(schema.developer.id, schema.app.developerId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(eq(schema.app.id, id))
  if (row?.status !== "listed" || !row.name) {
    await unindexStatement(storeKey(id)).run()
    return
  }
  await db.$client.batch(
    indexStatements([
      {
        key: storeKey(id),
        name: row.name,
        summary: row.summary ?? "",
        keywords: row.keywords ?? [],
        developer: row.developer,
      },
    ]),
  )
}
