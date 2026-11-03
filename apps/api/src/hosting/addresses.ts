import { env } from "cloudflare:workers"
import type { Links, ProjectSummary, Updater } from "@schelf/protocol"
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

function feedUrl(app: Addressed, updater: Updater, base: string) {
  if (updater === "sabine") return `${env.DOWNLOAD_URL}/sabine/${app.id}/stable.json`
  if (updater === "electron") return base
  return `${base}/tauri.json`
}

export function projectLinks(app: Addressed, publisherSlug: string, updaters: Updater[]): Links {
  const base = linkBase(app, publisherSlug)
  return {
    page: pageUrl(app, publisherSlug),
    latest: `${base}/latest`,
    json: `${base}/latest.json`,
    embed: `<a href="${base}/latest" data-schelf="${publisherSlug}/${app.slug}">Download</a>\n<script src="${env.DOWNLOAD_URL}/embed.js" async></script>`,
    feeds: updaters.map((updater) => ({ updater, url: feedUrl(app, updater, base) })),
  }
}
