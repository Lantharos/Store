import { catalog } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"
import { categoriesOf, categorySlug } from "#lib/store/categories.ts"

const PREVIEW = 3

export async function load({ setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const { apps } = await catalog()
  const ranked = apps.filter((app) => app.kind === "app").sort((a, b) => b.installs_30d - a.installs_30d)
  return {
    categories: categoriesOf(apps).map((category) => ({
      ...category,
      slug: categorySlug(category.name),
      apps: ranked.filter((app) => app.categories.includes(category.name)).slice(0, PREVIEW),
    })),
  }
}
