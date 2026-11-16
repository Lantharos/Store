import { waitUntil } from "cloudflare:workers"

export const EDGE_SECONDS = 60

/** Keeps a public response in the data centre's cache under `key`. */
export function keepAtEdge(key: string, response: Response) {
  if (response.headers.get("cache-control")?.startsWith("public"))
    waitUntil(caches.default.put(new Request(key), response))
}

/** The data centre's copy of the response under `key`, else `build`'s, kept there when it's public. */
export async function edgeResponse(key: string, build: () => Promise<Response>) {
  const cached = await caches.default.match(new Request(key))
  if (cached) return cached
  const response = await build()
  keepAtEdge(key, response.clone())
  return response
}

/** The data centre's copy of a value under `key`, else `load`'s, kept for `seconds`. */
export async function edgeValue<T>(key: string, load: () => Promise<T>, seconds = EDGE_SECONDS) {
  const request = new Request(key)
  const cached = await caches.default.match(request)
  if (cached) return cached.json<T>()
  const value = await load()
  waitUntil(
    caches.default.put(request, Response.json(value, { headers: { "cache-control": `max-age=${seconds}` } })),
  )
  return value
}
