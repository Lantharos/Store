import type { CatalogEntry } from "@schelf/protocol"

export const categorySlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const categoryHref = (name: string) => `/categories/${categorySlug(name)}`

export function categoriesOf(apps: CatalogEntry[]) {
  const counts = new Map<string, number>()
  for (const app of apps) {
    if (app.kind !== "app") continue
    for (const name of app.categories) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

export function inCategory(apps: CatalogEntry[], slug: string) {
  return apps.filter((app) => app.kind === "app" && app.categories.some((name) => categorySlug(name) === slug))
}
