import { env } from "cloudflare:workers"
import { PRIVATE_PREFIX } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { embedScript } from "../hosting/embed.ts"
import { isProjectPath, serveProject } from "../hosting/serve.ts"
import { INDEX_CACHE } from "../signing/write.ts"

const IMMUTABLE = "public, max-age=31536000, immutable"
const MEDIA_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
const SIGNED_PREFIXES = ["index/", "trust/", "sabine/"]

export interface Download {
  app: string
  version: string
  platform: string
}

export function downloadOf(key: string): Download | null {
  const [root, app, version, platform, file, ...rest] = key.split("/")
  if (root !== "apps" || !app || !version || !platform || !file || rest.length || platform === "checks")
    return null
  return { app, version, platform }
}

function startsAtZero(range: string | null) {
  return range === null || /^bytes=0-/.test(range.trim())
}

function count(download: Download, url: URL) {
  env.DOWNLOADS.writeDataPoint({
    blobs: [
      download.app,
      download.version,
      download.platform,
      url.searchParams.get("reason") === "update" ? "update" : "install",
    ],
    doubles: [1],
    indexes: [download.app],
  })
}

function cacheControl(key: string) {
  return SIGNED_PREFIXES.some((prefix) => key.startsWith(prefix)) ? INDEX_CACHE : IMMUTABLE
}

function feedOwner(key: string) {
  const [root, app, channel, ...rest] = key.split("/")
  return root === "sabine" && app && channel && !rest.length ? app : null
}

async function deleted(app: string) {
  return (await db.$count(schema.app, and(eq(schema.app.id, app), eq(schema.app.status, "deleted")))) > 0
}

async function missing(key: string) {
  const owner = feedOwner(key)
  if (owner && (await deleted(owner)))
    return new Response("Gone", { status: 410, headers: { "cache-control": INDEX_CACHE } })
  return new Response("Not found", { status: 404 })
}

export async function serveDownload(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } })
  const url = new URL(request.url)
  const key = decodeURIComponent(url.pathname.slice(1))
  if (key === "embed.js") return embedScript()
  const segments = key.split("/")
  if (isProjectPath(segments)) return serveProject(request, segments)
  if (
    !key ||
    key.startsWith(PRIVATE_PREFIX) ||
    key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  )
    return new Response("Not found", { status: 404 })

  const object =
    request.method === "HEAD"
      ? await env.BUCKET.head(key)
      : await env.BUCKET.get(key, { onlyIf: request.headers, range: request.headers })
  if (!object) return missing(key)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("etag", object.httpEtag)
  headers.set("cache-control", cacheControl(key))
  headers.set("accept-ranges", "bytes")
  headers.set("access-control-allow-origin", "*")
  headers.set("x-content-type-options", "nosniff")
  if (key.startsWith("media/")) headers.set("content-security-policy", MEDIA_POLICY)

  if (request.method === "HEAD") {
    headers.set("content-length", String(object.size))
    return new Response(null, { status: 200, headers })
  }
  if (!("body" in object)) return new Response(null, { status: 304, headers })
  const body = (object as R2ObjectBody).body

  const range = request.headers.get("range")
  const download = downloadOf(key)
  if (download && startsAtZero(range)) count(download, url)
  if (object.range && range) {
    const { offset = 0, length = object.size - offset } = object.range as { offset?: number; length?: number }
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set("content-length", String(length))
    return new Response(body, { status: 206, headers })
  }
  headers.set("content-length", String(object.size))
  return new Response(body, { status: 200, headers })
}
