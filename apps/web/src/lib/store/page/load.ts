import { type AppIndex, type AppPage, type IndexedRelease, STABLE } from "@schelf/protocol"
import { error } from "@sveltejs/kit"
import { firstParagraph, renderUserMarkdown } from "#lib/content/markdown.ts"
import { appSchema } from "#lib/seo/schema.ts"
import { extensionGrants } from "./access/extension.ts"

const HISTORY = 10

export type ShownRelease = Omit<IndexedRelease, "notes">
export type ShownApp = Omit<AppIndex, "releases"> & { releases: ShownRelease[] }

const withoutNotes = ({ notes: _notes, ...release }: IndexedRelease): ShownRelease => release

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
  const shown = stable[0] ?? app.releases[0]
  const description = app.listing.en!.description
  return {
    view: "store" as const,
    app: { ...app, releases: shown ? [withoutNotes(shown)] : [] } satisfies ShownApp,
    installs: found.installs,
    project: found.project,
    hasApp: found.has_app,
    parts: found.parts,
    inviteOnly: found.invite_only,
    tools: found.tools,
    extensionAccess: stable[0]?.extension ? extensionGrants(stable[0].extension) : null,
    path,
    blurb: firstParagraph(description).slice(0, 200),
    description: renderUserMarkdown(description),
    releases: stable.slice(0, HISTORY).map((release) => ({
      version: release.version,
      published: release.published,
      notes: renderUserMarkdown(release.notes),
    })),
    schema: appSchema(app, path, found.installs.total),
  }
}
