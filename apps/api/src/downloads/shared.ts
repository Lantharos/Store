import { keepAtEdge } from "../lib/edge-cache.ts"

const SHARED_PREFIXES = ["index/", "trust/", "sabine/", "media/"]
const SIGNED_PREFIXES = ["index/", "trust/"]
const SIGNATURE = ".sig"

export const sharedAtEdge = (request: Request, key: string) =>
  request.method === "GET" &&
  !request.headers.has("range") &&
  SHARED_PREFIXES.some((prefix) => key.startsWith(prefix))

/** A signed file's partner, its signature or the file it signs, which has to come from the same moment. */
function partnerOf(key: string, url: string) {
  if (!SIGNED_PREFIXES.some((prefix) => key.startsWith(prefix))) return null
  return url.endsWith(SIGNATURE) ? url.slice(0, -SIGNATURE.length) : `${url}${SIGNATURE}`
}

async function answer(request: Request, response: Response) {
  const etag = response.headers.get("etag")
  if (response.status !== 200 || !etag || !request.headers.get("if-none-match")?.includes(etag))
    return response
  await response.body!.cancel()
  return new Response(null, { status: 304, headers: response.headers })
}

/**
 * Small files clients poll, answered from the data centre's cache once found; a signed file and its signature are
 * fetched and kept together, so a client never pairs one version's file with another's signature.
 */
export async function serveShared(
  request: Request,
  key: string,
  fromBucket: (url: string) => Promise<Response>,
) {
  const own = new URL(request.url)
  own.search = ""
  const cached = await caches.default.match(new Request(own.href, { headers: request.headers }))
  if (cached) return cached
  const partner = partnerOf(key, own.href)
  const [response] = await Promise.all([
    fromBucket(own.href),
    partner &&
      fromBucket(partner).then((partnered) => partnered.status === 200 && keepAtEdge(partner, partnered)),
  ])
  if (response.status === 200) keepAtEdge(own.href, response.clone())
  return answer(request, response)
}
