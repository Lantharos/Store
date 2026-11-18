import { error } from "@sveltejs/kit"
import { catalog } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"
import { categoriesOf, categoryLabel, categorySlug, inCategory } from "#lib/store/categories.ts"

export async function load({ params, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const { apps } = await catalog()
  const categories = categoriesOf(apps)
  const current = categories.find((category) => categorySlug(category.name) === params.slug)
  if (!current) error(404, "There's no category by that name.")
  return {
    name: current.name,
    label: categoryLabel(current.name),
    slug: params.slug,
    categories,
    apps: inCategory(apps, params.slug).sort((a, b) => b.installs_30d - a.installs_30d),
  }
}
