import { developer } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"

export async function load({ params, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  return { developer: await developer(params.slug) }
}
