import { waitUntil } from "cloudflare:workers"
import type { Handle } from "@sveltejs/kit/hooks"
import { detect, systemKey } from "#lib/system/detect.ts"
import { building, version } from "$app/env"

const UNCACHED = /^\/(dashboard|api)(\/|$)/

function cacheKey(url: URL, key: string) {
  const keyed = new URL(url)
  keyed.searchParams.set("system", key)
  keyed.searchParams.set("build", version)
  return new Request(keyed)
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
    return resolve(event)
  }

  const key = cacheKey(event.url, systemKey(system))
  const cached = await caches.default.match(key)
  if (cached) return cached

  const response = await resolve(event)
  response.headers.set("accept-ch", "Sec-CH-UA-Platform, Sec-CH-UA-Arch")
  if (response.status < 500 && response.headers.get("cache-control")?.includes("s-maxage")) {
    waitUntil(caches.default.put(key, response.clone()))
  }
  return response
}
