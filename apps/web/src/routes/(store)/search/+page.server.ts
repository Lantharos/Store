import { catalog, search, searchExtensions } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"
import { categoriesOf } from "#lib/store/categories.ts"

export async function load({ url, locals, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const query = url.searchParams.get("q")?.trim() ?? ""
  if (!query) return { query, results: [], extensions: [], categories: categoriesOf((await catalog()).apps) }
  const [{ results }, extensions] = await Promise.all([search(query, locals.system), searchExtensions(query)])
  return { query, results, extensions: extensions.results.filter((hit) => hit.origin === "schelf"), categories: [] }
}
