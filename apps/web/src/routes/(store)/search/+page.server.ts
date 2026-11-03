import { catalog, search } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"
import { categoriesOf } from "#lib/store/categories.ts"

export async function load({ url, locals, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const query = url.searchParams.get("q")?.trim() ?? ""
  if (!query) return { query, results: [], categories: categoriesOf((await catalog()).apps) }
  const { results } = await search(query, locals.system)
  return { query, results, categories: [] }
}
