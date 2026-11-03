import { appPage, featured } from "#lib/api/store.ts"
import { siteSchema } from "#lib/seo/schema.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"

const HERO = 3

export async function load({ locals, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const home = await featured(locals.system)
  const [lead, ...sections] = home.sections
  const heroApps = (lead?.apps ?? []).filter((app) => Object.keys(app.platforms).length > 0).slice(0, HERO)
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
  const featuredIds = new Set(hero.map(({ app }) => app.id))
  return {
    hero,
    sections: [
      ...(lead ? [{ ...lead, apps: lead.apps.filter((app) => !featuredIds.has(app.id)) }] : []),
      ...sections,
    ].filter((section) => section.apps.length > 0),
    categories: home.categories,
    schema: siteSchema,
  }
}
