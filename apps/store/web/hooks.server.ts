import { waitUntil } from "cloudflare:workers"
import { detect, type System, systemKey } from "@schelf/protocol"
import type { Handle, HandleServerError, ResolveOptions } from "@sveltejs/kit/hooks"
import { storeVersion } from "#lib/server/cache.ts"
import { building, version } from "$app/env"

const UNCACHED = /^\/(dashboard|api)(\/|$)/
const OG_IMAGE = /\/og\.png$/
const SITEMAP = "/sitemap.xml"
const PRELOADED_FONT = /OpenRunde-(Regular|Semibold)\.woff2$/

const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
}

const options: ResolveOptions = {
  preload: (file) =>
    file.type === "js" || file.type === "css" || (file.type === "font" && PRELOADED_FONT.test(file.filename)),
}

async function cacheKey(request: Request, system: System) {
  const keyed = new URL(request.url)
  keyed.searchParams.set("build", version)
  if (OG_IMAGE.test(keyed.pathname)) return new Request(keyed)
  keyed.searchParams.set("store", await storeVersion())
  if (keyed.pathname !== SITEMAP) keyed.searchParams.set("system", systemKey(system))
  return new Request(keyed)
}

function secured(response: Response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value)
  return response
}

export const handle: Handle = async ({ event, resolve }) => {
  const headers = event.request.headers
  const system = detect(
    headers.get("user-agent") ?? "",
    headers.get("sec-ch-ua-platform"),
    headers.get("sec-ch-ua-arch"),
  )
  event.locals.system = system

  if (building || event.request.method !== "GET" || UNCACHED.test(event.url.pathname)) {
    return secured(await resolve(event, options))
  }

  const key = await cacheKey(event.request, system)
  const cached = await caches.default.match(key)
  if (cached) return cached

  const response = secured(await resolve(event, options))
  response.headers.set("accept-ch", "Sec-CH-UA-Platform, Sec-CH-UA-Arch")
  if (response.status < 500 && response.headers.get("cache-control")?.includes("s-maxage")) {
    waitUntil(caches.default.put(key, response.clone()))
  }
  return response
}

export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== "unknown") return
  console.error(event.url.pathname, error)
  return { message: "Something went wrong on our side. Try again in a moment." }
}
