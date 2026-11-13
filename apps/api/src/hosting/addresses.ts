import { env } from "cloudflare:workers"
import { type Links, type ProjectSummary, partUpdater, paths, STABLE, type Updater } from "@schelf/protocol"
import type { AppRow } from "../signing/records.ts"

type Addressed = Pick<AppRow, "id" | "kind" | "slug" | "visibility">

export function storePagePath(app: Pick<AppRow, "id" | "kind">) {
  return `/${app.kind === "extension" ? "extensions" : "apps"}/${app.id}`
}

export function projectPagePath(publisherSlug: string, app: Pick<AppRow, "slug">) {
  return `/${publisherSlug}/${app.slug}`
}

export function pageUrl(app: Addressed, publisherSlug: string) {
  return `${env.PUBLIC_URL}${app.visibility === "listed" ? storePagePath(app) : projectPagePath(publisherSlug, app)}`
}

export function linkBase(app: Pick<AppRow, "slug">, publisherSlug: string, channel?: string) {
  return `${env.DOWNLOAD_URL}/${publisherSlug}/${app.slug}${channel && channel !== "stable" ? `/@${channel}` : ""}`
}

export function projectSummary(
  app: Addressed & Pick<AppRow, "pageIndexed">,
  publisherSlug: string,
): ProjectSummary {
  return {
    publisher: publisherSlug,
    slug: app.slug,
    listed: app.visibility === "listed",
    indexed: app.visibility === "listed" || app.pageIndexed,
    page: pageUrl(app, publisherSlug),
    latest: `${linkBase(app, publisherSlug)}/latest`,
  }
}

function feedUrl(app: Addressed, updater: Updater, base: string, part: string | null) {
  if (updater === "sabine")
    return `${env.DOWNLOAD_URL}/${part ? paths.sabinePart(app.id, part, STABLE) : paths.sabine(app.id, STABLE)}`
  const root = part ? `${base}/latest/${part}` : base
  return updater === "electron" ? root : `${root}/tauri.json`
}

export function projectLinks(
  app: Addressed & Pick<AppRow, "parts">,
  publisherSlug: string,
  updaters: Updater[],
): Links {
  const base = linkBase(app, publisherSlug)
  const partFeeds = Object.entries(app.parts).flatMap(([part, settings]) => {
    const updater = partUpdater(settings)
    return updater ? [{ updater, part, url: feedUrl(app, updater, base, part) }] : []
  })
  return {
    page: pageUrl(app, publisherSlug),
    latest: `${base}/latest`,
    json: `${base}/latest.json`,
    embed: `<a href="${base}/latest" data-schelf="${publisherSlug}/${app.slug}">Download</a>\n<script src="${env.DOWNLOAD_URL}/embed.js" async></script>`,
    feeds: [
      ...updaters.map((updater) => ({ updater, part: null, url: feedUrl(app, updater, base, null) })),
      ...partFeeds,
    ],
  }
}
