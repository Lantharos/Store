import { error, redirect } from "@sveltejs/kit"
import { findAppPage, findMirrorApp } from "#lib/api/store.ts"
import { appSchema } from "#lib/seo/schema.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"
import { renderUserMarkdown } from "#lib/server/markdown.ts"
import { extensionGrants } from "#lib/store/page/extension.ts"

const KIND_PATH = { app: "apps", extension: "extensions" } as const

export async function load({ params, url, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const wanted = url.pathname.startsWith("/extensions/") ? "extension" : "app"
  const found = await findAppPage(params.id)

  if (!found) {
    const mirror = wanted === "app" ? await findMirrorApp(params.id) : null
    if (!mirror) error(404, "There's no app here. It may have moved or been removed.")
    return { view: "mirror" as const, mirror }
  }

  if (found.status === "pulled") error(410, "This app was removed from Schelf.")
  if (found.status === "delisted") error(404, "This app isn't listed on Schelf any more.")
  const { app } = found
  if (app.kind !== wanted || app.id !== params.id) redirect(308, `/${KIND_PATH[app.kind]}/${app.id}`)

  const path = `/${KIND_PATH[app.kind]}/${app.id}`
  return {
    view: "store" as const,
    app,
    installs: found.installs,
    extensionAccess: app.releases[0]?.extension ? extensionGrants(app.releases[0].extension) : null,
    path,
    description: renderUserMarkdown(app.listing.en!.description),
    releases: app.releases.map((release) => ({
      version: release.version,
      published: release.published,
      notes: renderUserMarkdown(release.notes),
    })),
    schema: appSchema(app, path, found.installs.total),
  }
}
