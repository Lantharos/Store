import { env } from "cloudflare:workers"
import { DEFAULT_LOCALE } from "@schelf/protocol"
import { and, eq, type SQL } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { mirrorDocument } from "./mirror.ts"
import { REINDEX_REQUEST } from "./reindex-request.ts"
import { indexStatements, type SearchDocument, storeKey, unindexStatements } from "./search-index.ts"

const DOCUMENTS_PER_BATCH = 130

async function listedDocuments(only?: SQL): Promise<SearchDocument[]> {
  const rows = await db
    .select({
      id: schema.app.id,
      name: schema.listing.name,
      summary: schema.listing.summary,
      keywords: schema.listing.keywords,
      publisher: schema.publisher.name,
    })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .innerJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(and(eq(schema.app.status, "published"), eq(schema.app.visibility, "listed"), only))
  return rows.filter((row) => row.name).map(({ id, ...row }) => ({ key: storeKey(id), ...row }))
}

export async function reindexApp(id: string) {
  const documents = await listedDocuments(eq(schema.app.id, id))
  await env.DB.batch(documents.length ? indexStatements(documents) : unindexStatements(storeKey(id)))
}

/** Indexes every listed app and mirror entry again, when a migration or a seed asks for it. */
export async function reindexIfRequested() {
  const requested = await db.query.storeState.findFirst({ where: eq(schema.storeState.key, REINDEX_REQUEST) })
  if (!requested) return
  const [apps, mirrored] = await Promise.all([listedDocuments(), db.select().from(schema.mirrorApp)])
  const documents = [...apps, ...mirrored.map(mirrorDocument)]
  for (let start = 0; start < documents.length; start += DOCUMENTS_PER_BATCH)
    await env.DB.batch(indexStatements(documents.slice(start, start + DOCUMENTS_PER_BATCH)))
  await db.delete(schema.storeState).where(eq(schema.storeState.key, REINDEX_REQUEST))
}
