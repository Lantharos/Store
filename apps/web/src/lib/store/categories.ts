import type { CatalogEntry } from "@schelf/protocol"

const LABELS: Record<string, string> = {
  AudioVideo: "Music and video",
  Audio: "Music",
  Video: "Video",
  Development: "Developer tools",
  Education: "Education",
  Game: "Games",
  Graphics: "Graphics and photos",
  Network: "Internet",
  Office: "Productivity",
  Science: "Science",
  Settings: "Settings",
  System: "System",
  Utility: "Utilities",
  Finance: "Finance",
  Weather: "Weather",
}

export const CATEGORY_CHOICES = Object.keys(LABELS)

export const primaryCategory = (categories: string[]) => categories[0]

export const categoryLabel = (name: string) => LABELS[name] ?? name.replace(/([a-z])([A-Z])/g, "$1 $2")

export const categorySlug = (name: string) =>
  categoryLabel(name)
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
  return apps.filter(
    (app) => app.kind === "app" && app.categories.some((name) => categorySlug(name) === slug),
  )
}
