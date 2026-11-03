import { error } from "@sveltejs/kit"
import { media } from "#lib/api/server.ts"
import { appPage } from "#lib/api/store.ts"
import { appCard, drawable } from "#lib/seo/og/card.ts"

export async function GET({ params }) {
  const { app, status } = await appPage(params.id)
  if (status !== "listed") error(404, "Nothing here")
  const listing = app.listing.en!
  const screenshot = app.screenshots.find((shot) => drawable(shot.url))
  const [icon, shot] = await Promise.all([app.icon && media(app.icon), screenshot && media(screenshot.url)])
  return appCard({
    name: listing.name,
    summary: listing.summary,
    icon: icon || null,
    screenshot: shot || null,
    developer: app.developer.name,
  })
}
