import { DEFAULT_LOCALE, LOCALE, updateListing, updateMeta } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { refuseIfListingInFiles, refuseIfSetInFiles } from "../../config/managed.ts"
import { db, schema } from "../../db/client.ts"
import { fail, readBody } from "../../lib/http.ts"
import { appAccess } from "../../publishers/access.ts"
import { resignApp } from "../../signing/queue.ts"
import type { AppRow } from "../../signing/records.ts"
import { reindexApp } from "../../storefront/indexing.ts"
import { appSettings } from "./settings.ts"

const INDEXED = new Set(["published", "delisted", "pulled"])

export async function listingChanged(app: AppRow) {
  if (INDEXED.has(app.status)) await Promise.all([resignApp(app.id), reindexApp(app.id)])
}

export const listingRoutes = new Hono<SignedInVars>()

listingRoutes.put("/:id/listing/:locale", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfListingInFiles(app)
  const locale = c.req.param("locale")
  if (!LOCALE.test(locale)) fail(422, "That isn't a locale")
  const row = await readBody(c, updateListing)
  await db
    .insert(schema.listing)
    .values({ appId: app.id, locale, ...row })
    .onConflictDoUpdate({ target: [schema.listing.appId, schema.listing.locale], set: row })
  await listingChanged(app)
  return c.json(await appSettings(app))
})

listingRoutes.delete("/:id/listing/:locale", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfListingInFiles(app)
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
  const input = await readBody(c, updateMeta)
  const fields = {
    ...(input.categories !== undefined && { categories: input.categories }),
    ...(input.homepage !== undefined && { homepage: input.homepage }),
    ...(input.support !== undefined && { support: input.support }),
    ...(input.privacy_url !== undefined && { privacyUrl: input.privacy_url }),
    ...(input.content_rating !== undefined && { contentRating: input.content_rating }),
    ...(input.brand_color !== undefined && { brandColor: input.brand_color }),
  }
  if (Object.keys(fields).length) {
    refuseIfListingInFiles(app)
    await db
      .insert(schema.listingMeta)
      .values({ appId: app.id, ...fields })
      .onConflictDoUpdate({ target: schema.listingMeta.appId, set: fields })
  }
  const appChanges = {
    ...(input.licence !== undefined && { licence: input.licence }),
    ...(input.distribution !== undefined && { distribution: input.distribution }),
  }
  if (Object.keys(appChanges).length) {
    refuseIfSetInFiles(app)
    await db.update(schema.app).set(appChanges).where(eq(schema.app.id, app.id))
  }
  await listingChanged(app)
  return c.json(await appSettings({ ...app, ...appChanges }))
})
