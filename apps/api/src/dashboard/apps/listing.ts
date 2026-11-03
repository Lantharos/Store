import { DEFAULT_LOCALE, updateListing, updateMeta } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { DeveloperVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { fail, readBody } from "../../lib/http.ts"
import { resignApp } from "../../signing/queue.ts"
import type { AppRow } from "../../signing/records.ts"
import { reindexApp } from "../../storefront/indexing.ts"
import { ownedApp } from "../access.ts"
import { appSettings } from "./settings.ts"

const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/
const INDEXED = new Set(["listed", "delisted", "pulled"])

export async function listingChanged(app: AppRow) {
  if (INDEXED.has(app.status)) await Promise.all([resignApp(app.id), reindexApp(app.id)])
}

export const listingRoutes = new Hono<DeveloperVars>()

listingRoutes.put("/:id/listing/:locale", async (c) => {
  const app = await ownedApp(c.var.developer, c.req.param("id"))
  const locale = c.req.param("locale")
  if (!LOCALE.test(locale)) fail(422, "That isn't a locale")
  const text = await readBody(c, updateListing)
  await db
    .insert(schema.listing)
    .values({ appId: app.id, locale, ...text })
    .onConflictDoUpdate({ target: [schema.listing.appId, schema.listing.locale], set: text })
  await listingChanged(app)
  return c.json(await appSettings(app))
})

listingRoutes.delete("/:id/listing/:locale", async (c) => {
  const app = await ownedApp(c.var.developer, c.req.param("id"))
  const locale = c.req.param("locale")
  if (locale === DEFAULT_LOCALE) fail(422, "The English listing is required")
  await db
    .delete(schema.listing)
    .where(and(eq(schema.listing.appId, app.id), eq(schema.listing.locale, locale)))
  await listingChanged(app)
  return c.json(await appSettings(app))
})

listingRoutes.patch("/:id/meta", async (c) => {
  const app = await ownedApp(c.var.developer, c.req.param("id"))
  const input = await readBody(c, updateMeta)
  const meta = {
    ...(input.categories !== undefined && { categories: input.categories }),
    ...(input.homepage !== undefined && { homepage: input.homepage }),
    ...(input.support !== undefined && { support: input.support }),
    ...(input.privacy_url !== undefined && { privacyUrl: input.privacy_url }),
    ...(input.content_rating !== undefined && { contentRating: input.content_rating }),
    ...(input.brand_color !== undefined && { brandColor: input.brand_color }),
  }
  if (Object.keys(meta).length)
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
