import { env } from "cloudflare:workers"
import { DOWNLOAD_ORIGIN, paths } from "@schelf/protocol"

export const STOREFRONT_CACHE = "public, max-age=0, must-revalidate, s-maxage=300"
export const FILE_CACHE = "public, max-age=86400, s-maxage=604800"

const VERSION_FRESH_MS = 15_000

let catalogVersion = { etag: "", checkedAt: 0 }

export async function storeVersion() {
  if (Date.now() - catalogVersion.checkedAt < VERSION_FRESH_MS) return catalogVersion.etag
  const response = await env.API.fetch(`${DOWNLOAD_ORIGIN}/${paths.catalog}`, { method: "HEAD" })
  catalogVersion = { etag: response.headers.get("etag") ?? "", checkedAt: Date.now() }
  return catalogVersion.etag
}
