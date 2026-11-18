import { rasterIcon } from "@schelf/protocol"
import { error } from "@sveltejs/kit"
import { icon, screenshotPng } from "#lib/api/server.ts"
import { appPage } from "#lib/api/store.ts"
import { appCard } from "#lib/seo/og/card.ts"

export async function GET({ params }) {
  const { app, status } = await appPage(params.id)
  if (status !== "published") error(404, "Nothing here")
  const listing = app.listing.en!
  const screenshot = app.screenshots[0]
  const [iconData, shot] = await Promise.all([
    app.icon && icon(rasterIcon(app.icon)),
    screenshot && screenshotPng(screenshot.url),
  ])
  return appCard({
    name: listing.name,
    summary: listing.summary,
    icon: iconData || null,
    screenshot: shot || null,
    publisher: app.publisher.name,
  })
}
