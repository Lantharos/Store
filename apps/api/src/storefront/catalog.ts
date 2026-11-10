import { env } from "cloudflare:workers"
import { type Catalog, type CatalogEntry, paths, type Unstamped } from "@schelf/protocol"

const FRESH_MS = 30_000

type Listed = Unstamped<Catalog>

let cached: { etag: string; checkedAt: number; catalog: Listed; byId: Map<string, CatalogEntry> } | undefined
const EMPTY: Listed = { version: 1, generated: new Date(0).toISOString(), apps: [] }

export async function currentCatalog() {
  if (cached && Date.now() - cached.checkedAt < FRESH_MS) return cached
  const object = await env.BUCKET.get(
    paths.catalog,
    cached ? { onlyIf: { etagDoesNotMatch: cached.etag } } : {},
  )
  if (cached && object && !("body" in object)) {
    cached.checkedAt = Date.now()
    return cached
  }
  const catalog = object && "body" in object ? await object.json<Listed>() : EMPTY
  cached = {
    etag: object?.etag ?? "",
    checkedAt: Date.now(),
    catalog,
    byId: new Map(catalog.apps.map((entry) => [entry.id, entry])),
  }
  return cached
}
