import { error, redirect } from "@sveltejs/kit"
import { findAppPage, findMirrorApp } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"
import { storePage } from "#lib/store/page/load.ts"

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

  if (!found.project.listed) redirect(308, new URL(found.project.page).pathname)
  const { app } = found
  if (app.kind !== wanted || app.id !== params.id) redirect(308, `/${KIND_PATH[app.kind]}/${app.id}`)
  return storePage(found, `/${KIND_PATH[app.kind]}/${app.id}`)
}
