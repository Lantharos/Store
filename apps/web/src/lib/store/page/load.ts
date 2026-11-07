import { type AppPage, STABLE } from "@schelf/protocol"
import { error } from "@sveltejs/kit"
import { renderUserMarkdown } from "#lib/content/markdown.ts"
import { appSchema } from "#lib/seo/schema.ts"
import { extensionGrants } from "./extension.ts"

export function storePage(found: AppPage, path: string) {
  if (found.status === "pulled") error(410, "This app was removed from Schelf.")
  if (found.status === "delisted" && found.replacement)
    return {
      view: "replaced" as const,
      app: found.app,
      replacement: { ...found.replacement, page: new URL(found.replacement.page).pathname },
      path,
    }
  if (found.status === "delisted") error(404, "This app isn't listed on Schelf any more.")
  const { app } = found
  const stable = app.releases.filter((release) => release.channel === STABLE)
  return {
    view: "store" as const,
    app,
    installs: found.installs,
    project: found.project,
    extensionAccess: stable[0]?.extension ? extensionGrants(stable[0].extension) : null,
    path,
    description: renderUserMarkdown(app.listing.en!.description),
    releases: stable.map((release) => ({
      version: release.version,
      published: release.published,
      notes: renderUserMarkdown(release.notes),
    })),
    schema: appSchema(app, path, found.installs.total),
  }
}
