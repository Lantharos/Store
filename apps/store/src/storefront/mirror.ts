import { env } from "cloudflare:workers"
import type { MirrorEntry, MirrorRequest, MirrorResponse } from "@schelf/protocol"
import { and, eq, isNull } from "drizzle-orm"
import { among, db, schema } from "../db/client.ts"
import { mirrorCatalogEntry } from "../signing/documents.ts"
import { resign } from "../signing/queue.ts"
import { addStatements, clearOriginStatements, type SearchDocument } from "./search-index.ts"

const ORIGIN = "flathub"
const STATEMENTS_PER_BATCH = 400

const mirrorKey = (id: string) => `${ORIGIN}:${id}`

type MirrorRow = typeof schema.mirrorApp.$inferSelect

export function mirrorDocument(
  row: Pick<MirrorRow, "id" | "name" | "summary" | "categories" | "publisher">,
): SearchDocument {
  return {
    key: mirrorKey(row.id),
    name: row.name,
    summary: row.summary,
    keywords: row.categories,
    publisher: row.publisher,
  }
}

/** The index tells keys apart without case, so of entries whose ids differ only in case the last one stays. */
function oncePerKey(documents: SearchDocument[]) {
  return [...new Map(documents.map((document) => [document.key.toLowerCase(), document])).values()]
}

export async function mirrorHits(keys: string[]) {
  const ids = keys.filter((key) => key.startsWith(`${ORIGIN}:`)).map((key) => key.slice(ORIGIN.length + 1))
  const hits = new Map<string, MirrorEntry>()
  if (!ids.length) return hits
  const rows = await db.select().from(schema.mirrorApp).where(among(schema.mirrorApp.id, ids))
  for (const row of rows) if (!row.hiddenReason) hits.set(mirrorKey(row.id), mirrorCatalogEntry(row))
  return hits
}

export async function mirrorEntry(id: string) {
  const [row] = await db
    .select()
    .from(schema.mirrorApp)
    .where(and(eq(schema.mirrorApp.id, id), isNull(schema.mirrorApp.hiddenReason)))
  return row ? mirrorCatalogEntry(row) : null
}

export async function replaceMirror(request: MirrorRequest): Promise<MirrorResponse> {
  const insert = env.DB.prepare(
    `INSERT INTO mirror_app (id, origin, ref, name, summary, icon, categories, developer, verified, installs_30d, updated_at, hidden_reason, rank)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  )
  const statements = [
    env.DB.prepare("DELETE FROM mirror_app"),
    ...clearOriginStatements(ORIGIN),
    ...request.flathub.map((entry) =>
      insert.bind(
        entry.id,
        ORIGIN,
        entry.flathub,
        entry.name,
        entry.summary,
        entry.icon,
        JSON.stringify(entry.categories),
        entry.publisher.name,
        entry.publisher.verified ? 1 : 0,
        entry.installs_30d,
        new Date(entry.updated).getTime(),
        entry.rank,
      ),
    ),
    ...addStatements(
      oncePerKey(
        request.flathub.map((entry) => mirrorDocument({ ...entry, publisher: entry.publisher.name })),
      ),
    ),
  ]
  for (let start = 0; start < statements.length; start += STATEMENTS_PER_BATCH)
    await env.DB.batch(statements.slice(start, start + STATEMENTS_PER_BATCH))
  await resign({ type: "mirror" })
  return { flathub: request.flathub.length }
}
