import { DEFAULT_LOCALE, type FieldSources, type ListingFile, type ListingSource } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { listingChanged } from "../dashboard/apps/listing.ts"
import { db, schema } from "../db/client.ts"
import type { AppRow } from "../signing/records.ts"

function changesFrom<Fields extends object>(
  file: Fields,
  current: Partial<Record<keyof Fields, unknown>>,
  sources: FieldSources,
) {
  const changed = Object.entries(file).filter(
    ([field, value]) =>
      value !== undefined &&
      sources[field] !== "dashboard" &&
      JSON.stringify(current[field as keyof Fields]) !== JSON.stringify(value),
  )
  return Object.fromEntries(changed) as Partial<Fields>
}

const sourcedFromFile = (sources: FieldSources, changes: object): FieldSources => ({
  ...sources,
  ...Object.fromEntries(Object.keys(changes).map((field): [string, ListingSource] => [field, "listing"])),
})

async function applyWords(appId: string, words: Pick<ListingFile, "summary" | "description" | "keywords">) {
  const english = and(eq(schema.listing.appId, appId), eq(schema.listing.locale, DEFAULT_LOCALE))
  const existing = await db.query.listing.findFirst({ where: english })
  if (!existing) return false
  const changes = changesFrom(words, existing, existing.sources)
  if (!Object.keys(changes).length) return false
  await db
    .update(schema.listing)
    .set({ ...changes, sources: sourcedFromFile(existing.sources, changes) })
    .where(english)
  return true
}

async function applyDetails(
  appId: string,
  details: Omit<ListingFile, "summary" | "description" | "keywords">,
) {
  const existing = await db.query.listingMeta.findFirst({ where: eq(schema.listingMeta.appId, appId) })
  const current = {
    categories: existing?.categories,
    homepage: existing?.homepage,
    support: existing?.support,
    privacy_url: existing?.privacyUrl,
    brand_color: existing?.brandColor,
  }
  const sources = existing?.sources ?? {}
  const changes = changesFrom(details, current, sources)
  if (!Object.keys(changes).length) return false
  const { privacy_url, brand_color, ...sameName } = changes
  const row = {
    ...sameName,
    ...(privacy_url !== undefined && { privacyUrl: privacy_url }),
    ...(brand_color !== undefined && { brandColor: brand_color }),
    sources: sourcedFromFile(sources, changes),
  }
  await db
    .insert(schema.listingMeta)
    .values({ appId, ...row })
    .onConflictDoUpdate({ target: schema.listingMeta.appId, set: row })
  return true
}

export async function applyListingFile(app: AppRow, file: ListingFile) {
  const { summary, description, keywords, ...details } = file
  const changed = await Promise.all([
    applyWords(app.id, { summary, description, keywords }),
    applyDetails(app.id, details),
  ])
  if (changed.some(Boolean)) await listingChanged(app)
}
