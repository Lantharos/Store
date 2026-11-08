import { STORE_ORIGIN } from "@schelf/protocol"
import { catalog } from "#lib/api/store.ts"
import { LEGAL_SLUGS } from "#lib/content/slugs.ts"
import { DOC_ORDER, docHref } from "#lib/docs/nav.ts"
import { FILE_CACHE } from "#lib/server/cache.ts"
import { categoriesOf, categoryHref } from "#lib/store/categories.ts"
import { appHref } from "#lib/store/links.ts"

const escapeXml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")

export async function GET() {
  const { apps } = await catalog()
  const entries: { path: string; updated?: string }[] = [
    { path: "/" },
    { path: "/categories" },
    { path: "/extensions" },
    { path: "/brand" },
    ...categoriesOf(apps).map((category) => ({ path: categoryHref(category.name) })),
    ...apps.map((app) => ({ path: appHref(app), updated: app.updated })),
    ...[...new Set(apps.map((app) => app.publisher.slug))].map((slug) => ({ path: `/publishers/${slug}` })),
    ...DOC_ORDER.map((slug) => ({ path: docHref(slug) })),
    ...LEGAL_SLUGS.map((slug) => ({ path: `/legal/${slug}` })),
  ]
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    ({ path, updated }) =>
      `  <url><loc>${escapeXml(STORE_ORIGIN + path)}</loc>${updated ? `<lastmod>${updated.slice(0, 10)}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>
`
  return new Response(body, { headers: { "content-type": "application/xml", "cache-control": FILE_CACHE } })
}
