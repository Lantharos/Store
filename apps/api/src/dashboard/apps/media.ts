import { env } from "cloudflare:workers"
import {
  type DashboardScreenshot,
  MAX_ICON_BYTES,
  MAX_SCREENSHOT_BYTES,
  paths,
  rasterIcon,
  reorderScreenshots,
  screenshotUpload,
  sha256Hex,
  sniffImage,
} from "@schelf/protocol"
import { and, eq, max } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { refuseIfListingInFiles } from "../../config/managed.ts"
import { db, schema } from "../../db/client.ts"
import { fail, readBody, readQuery } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { appAccess } from "../../publishers/access.ts"
import { fileUrl } from "../../signing/records.ts"
import { listingChanged } from "./listing.ts"

const IMMUTABLE = "public, max-age=31536000, immutable"
const MIN_SCREENSHOT_EDGE = 640

export const mediaRoutes = new Hono<SignedInVars>()

export async function storeImage(
  request: Request,
  keyFor: (hash: string, extension: string) => string,
  limit: number,
  allowSvg: boolean,
) {
  const length = Number(request.headers.get("content-length"))
  if (!length || length > limit) fail(413, `Images can be up to ${Math.round(limit / 1024 / 1024)} MB`)
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > limit) fail(413, `Images can be up to ${Math.round(limit / 1024 / 1024)} MB`)
  const image = sniffImage(bytes, allowSvg)
  if (!image) fail(422, allowSvg ? "Upload a PNG, JPEG, WebP or SVG" : "Upload a PNG, JPEG or WebP")
  const key = keyFor(await sha256Hex(bytes), image.extension)
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: image.type, cacheControl: IMMUTABLE } })
  return { key, image, bytes }
}

async function storeIconPng(svgKey: string, svg: Uint8Array) {
  const { iconPng } = await import("./icon-png.ts")
  await env.BUCKET.put(rasterIcon(svgKey), await iconPng(svg), {
    httpMetadata: { contentType: "image/png", cacheControl: IMMUTABLE },
  })
}

mediaRoutes.put("/:id/icon", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfListingInFiles(app)
  const { key, image, bytes } = await storeImage(
    c.req.raw,
    (hash, extension) => paths.media(app.id, hash, extension),
    MAX_ICON_BYTES,
    true,
  )
  if (image.width !== image.height) fail(422, "Icons are square")
  if (image.extension === "svg") await storeIconPng(key, bytes)
  await db
    .insert(schema.listingMeta)
    .values({ appId: app.id, iconKey: key })
    .onConflictDoUpdate({ target: schema.listingMeta.appId, set: { iconKey: key } })
  await listingChanged(app)
  return c.json({ url: fileUrl(key) })
})

mediaRoutes.post("/:id/screenshots", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfListingInFiles(app)
  const options = readQuery(c, screenshotUpload)
  const { key, image } = await storeImage(
    c.req.raw,
    (hash, extension) => paths.media(app.id, hash, extension),
    MAX_SCREENSHOT_BYTES,
    false,
  )
  if (Math.min(image.width, image.height) < MIN_SCREENSHOT_EDGE)
    fail(422, `Screenshots are at least ${MIN_SCREENSHOT_EDGE} pixels on each side`)
  const [last] = await db
    .select({ position: max(schema.screenshot.position) })
    .from(schema.screenshot)
    .where(eq(schema.screenshot.appId, app.id))
  const shot = {
    id: randomId(),
    appId: app.id,
    platform: options.platform ?? null,
    position: (last?.position ?? -1) + 1,
    key,
    width: image.width,
    height: image.height,
    caption: options.caption ?? null,
  }
  await db.insert(schema.screenshot).values(shot)
  await listingChanged(app)
  return c.json(
    {
      id: shot.id,
      position: shot.position,
      platform: options.platform ?? null,
      url: fileUrl(key),
      width: shot.width,
      height: shot.height,
      caption: shot.caption,
    } satisfies DashboardScreenshot,
    201,
  )
})

mediaRoutes.put("/:id/screenshots/order", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfListingInFiles(app)
  const { ids } = await readBody(c, reorderScreenshots)
  await db.batch(
    ids.map((id, position) =>
      db
        .update(schema.screenshot)
        .set({ position })
        .where(and(eq(schema.screenshot.id, id), eq(schema.screenshot.appId, app.id))),
    ) as never,
  )
  await listingChanged(app)
  return c.body(null, 204)
})

mediaRoutes.delete("/:id/screenshots/:shot", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfListingInFiles(app)
  await db
    .delete(schema.screenshot)
    .where(and(eq(schema.screenshot.id, c.req.param("shot")), eq(schema.screenshot.appId, app.id)))
  await listingChanged(app)
  return c.body(null, 204)
})
