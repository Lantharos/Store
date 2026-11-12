import { env } from "cloudflare:workers"
import { MAX_MEDIA_BYTES, paths, rasterIcon, sha256Hex, sniffImage } from "@schelf/protocol"
import { fail } from "../lib/http.ts"
import type { AppRow } from "../signing/records.ts"

const IMMUTABLE = "public, max-age=31536000, immutable"
const HASH = /^[0-9a-f]{64}$/

export interface StoredMedia {
  key: string
  width: number
  height: number
  svg: boolean
}

export async function storedMedia(app: AppRow): Promise<Map<string, StoredMedia>> {
  const listed = await env.BUCKET.list({ prefix: `media/${app.id}/`, include: ["customMetadata"] })
  const found = new Map<string, StoredMedia>()
  for (const object of listed.objects) {
    const [hash, extension] = object.key.slice(`media/${app.id}/`.length).split(".")
    const size = object.customMetadata
    if (!hash || !size?.width || !size.height) continue
    found.set(hash, {
      key: object.key,
      width: Number(size.width),
      height: Number(size.height),
      svg: extension === "svg",
    })
  }
  return found
}

async function storeRaster(key: string, svg: Uint8Array) {
  const { iconPng } = await import("../dashboard/apps/icon-png.ts")
  await env.BUCKET.put(rasterIcon(key), await iconPng(svg), {
    httpMetadata: { contentType: "image/png", cacheControl: IMMUTABLE },
  })
}

export async function receiveMedia(app: AppRow, hash: string, request: Request) {
  if (!HASH.test(hash)) fail(404, "Not found")
  const length = Number(request.headers.get("content-length"))
  if (!length || length > MAX_MEDIA_BYTES) fail(413, "Images can be up to 8 MB")
  const bytes = new Uint8Array(await request.arrayBuffer())
  if ((await sha256Hex(bytes)) !== hash) fail(422, "The image doesn't match its SHA-256")
  const image = sniffImage(bytes, true)
  if (!image) fail(422, "Send a PNG, JPEG, WebP or SVG")
  const key = paths.media(app.id, hash, image.extension)
  await env.BUCKET.put(key, bytes, {
    httpMetadata: { contentType: image.type, cacheControl: IMMUTABLE },
    customMetadata: { width: String(image.width), height: String(image.height) },
  })
  if (image.extension === "svg") await storeRaster(key, bytes)
  return { key }
}
