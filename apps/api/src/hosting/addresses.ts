import { env } from "cloudflare:workers"
import type { Links, ProjectSummary } from "@schelf/protocol"
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

function feeds(app: Addressed & Pick<AppRow, "updater">, base: string) {
  if (app.updater === "sabine")
    return [{ name: "Sabine", url: `${env.DOWNLOAD_URL}/sabine/${app.id}/stable.json` }]
  if (app.updater === "electron") return [{ name: "electron-updater", url: base }]
  if (app.updater === "tauri") return [{ name: "Tauri", url: `${base}/tauri.json` }]
  return []
}

export function projectLinks(app: Addressed & Pick<AppRow, "updater">, publisherSlug: string): Links {
  const base = linkBase(app, publisherSlug)
  return {
    page: pageUrl(app, publisherSlug),
    latest: `${base}/latest`,
    json: `${base}/latest.json`,
    embed: `<a href="${base}/latest" data-schelf="${publisherSlug}/${app.slug}">Download</a>\n<script src="${env.DOWNLOAD_URL}/embed.js" async></script>`,
    feeds: feeds(app, base),
  }
}
