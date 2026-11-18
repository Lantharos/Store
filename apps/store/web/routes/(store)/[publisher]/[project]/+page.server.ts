import { error, redirect } from "@sveltejs/kit"
import { findProjectPage } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"
import { storePage } from "#lib/store/page/load.ts"

export async function load({ params, setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const found = await findProjectPage(params.publisher, params.project)
  if (!found) error(404, "There's nothing here. It may have moved or been removed.")
  const path = new URL(found.project.page).pathname
  if (found.project.listed || path !== `/${params.publisher}/${params.project}`) redirect(308, path)
  return storePage(found, path)
}
