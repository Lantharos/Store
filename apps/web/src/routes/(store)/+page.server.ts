import { appPage, featured } from "#lib/api/store.ts"
import { siteSchema } from "#lib/seo/schema.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"

const HERO = 3
const MIN_CATEGORY_SIZE = 2

export async function load({ locals, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const home = await featured(locals.system)
  const heroApps = (home.sections[0]?.apps ?? []).slice(0, HERO)
  const pages = await Promise.all(heroApps.map((app) => appPage(app.id)))
  const hero = heroApps.map((app, index) => {
    const detail = pages[index]!.app
    return {
      app,
      brand: detail.brand_color,
      blurb: detail.listing.en?.description.split("\n\n")[0] ?? null,
      screenshot: detail.screenshots[0]?.url ?? null,
    }
  })
  const shown = new Set(hero.map(({ app }) => app.id))
  const sections = home.sections
    .map((section) => {
      const apps = section.apps.filter((app) => !shown.has(app.id))
      for (const app of apps) shown.add(app.id)
      const waiting = apps.every((app) => Object.keys(app.platforms).length === 0)
      return { ...section, title: waiting ? "Coming soon" : section.title, waiting, apps }
    })
    .filter((section) => section.apps.length > 0)
  return {
    hero,
    sections,
    categories: home.categories.filter((category) => category.count >= MIN_CATEGORY_SIZE),
    schema: siteSchema,
  }
}
