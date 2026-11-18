import { catalog } from "#lib/api/store.ts"
import { STOREFRONT_CACHE } from "#lib/server/cache.ts"

export async function load({ setHeaders }) {
  setHeaders({ "cache-control": STOREFRONT_CACHE })
  const { apps } = await catalog()
  return {
    extensions: apps
      .filter((app) => app.kind === "extension")
      .sort((a, b) => b.installs_30d - a.installs_30d),
  }
}
