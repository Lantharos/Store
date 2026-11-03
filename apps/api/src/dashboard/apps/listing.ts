import {
  DEFAULT_LOCALE,
  type FieldSources,
  type ListingSource,
  updateListing,
  updateMeta,
} from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { fail, readBody } from "../../lib/http.ts"
import { appAccess } from "../../publishers/access.ts"
import { resignApp } from "../../signing/queue.ts"
import type { AppRow } from "../../signing/records.ts"
import { reindexApp } from "../../storefront/indexing.ts"
import { appSettings } from "./settings.ts"

const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/
const INDEXED = new Set(["published", "delisted", "pulled"])

export async function listingChanged(app: AppRow) {
  if (INDEXED.has(app.status)) await Promise.all([resignApp(app.id), reindexApp(app.id)])
}

function traced(
  before: Record<string, unknown> | null,
  sources: FieldSources,
  changes: Record<string, unknown>,
  source: ListingSource,
): FieldSources {
  const next = { ...sources }
  for (const [field, value] of Object.entries(changes)) {
    const changed = !before || JSON.stringify(before[field]) !== JSON.stringify(value)
    if (source !== "dashboard" || changed) next[field] = source
  }
  return next
}

export const listingRoutes = new Hono<SignedInVars>()

listingRoutes.put("/:id/listing/:locale", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  const locale = c.req.param("locale")
  if (!LOCALE.test(locale)) fail(422, "That isn't a locale")
  const { source, ...text } = await readBody(c, updateListing)
  const existing = await db.query.listing.findFirst({
    where: and(eq(schema.listing.appId, app.id), eq(schema.listing.locale, locale)),
  })
  const row = { ...text, sources: traced(existing ?? null, existing?.sources ?? {}, text, source) }
  await db
    .insert(schema.listing)
    .values({ appId: app.id, locale, ...row })
    .onConflictDoUpdate({ target: [schema.listing.appId, schema.listing.locale], set: row })
  await listingChanged(app)
  return c.json(await appSettings(app))
})

listingRoutes.delete("/:id/listing/:locale", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  const locale = c.req.param("locale")
  if (locale === DEFAULT_LOCALE) fail(422, "The English listing is required")
  await db
    .delete(schema.listing)
    .where(and(eq(schema.listing.appId, app.id), eq(schema.listing.locale, locale)))
  await listingChanged(app)
  return c.json(await appSettings(app))
})

listingRoutes.patch("/:id/meta", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  const { source, ...input } = await readBody(c, updateMeta)
  const existing = await db.query.listingMeta.findFirst({ where: eq(schema.listingMeta.appId, app.id) })
  const fields = {
    ...(input.categories !== undefined && { categories: input.categories }),
    ...(input.homepage !== undefined && { homepage: input.homepage }),
    ...(input.support !== undefined && { support: input.support }),
    ...(input.privacy_url !== undefined && { privacyUrl: input.privacy_url }),
    ...(input.content_rating !== undefined && { contentRating: input.content_rating }),
    ...(input.brand_color !== undefined && { brandColor: input.brand_color }),
  }
  const { distribution: _, ...traceable } = input
  const before = {
    categories: existing?.categories,
    homepage: existing?.homepage,
    support: existing?.support,
    privacy_url: existing?.privacyUrl,
    content_rating: existing?.contentRating,
    brand_color: existing?.brandColor,
    licence: app.licence,
  }
  const meta = { ...fields, sources: traced(before, existing?.sources ?? {}, traceable, source) }
  if (Object.keys(traceable).length)
    await db
      .insert(schema.listingMeta)
      .values({ appId: app.id, ...meta })
      .onConflictDoUpdate({ target: schema.listingMeta.appId, set: meta })
  const appChanges = {
    ...(input.licence !== undefined && { licence: input.licence }),
    ...(input.distribution !== undefined && { distribution: input.distribution }),
  }
  if (Object.keys(appChanges).length)
    await db.update(schema.app).set(appChanges).where(eq(schema.app.id, app.id))
  await listingChanged(app)
  return c.json(await appSettings({ ...app, ...appChanges }))
})
