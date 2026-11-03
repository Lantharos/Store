import { env } from "cloudflare:workers"
import { b } from "@lantharos/pult"
import { pageUrl } from "../../hosting/addresses.ts"
import type { AppRow } from "../../signing/records.ts"

export function appPage(
  app: Pick<AppRow, "id" | "kind" | "slug" | "visibility" | "status">,
  publisherSlug: string,
) {
  if (app.status !== "published") return undefined
  return pageUrl(app, publisherSlug)
}

export function publisherPage(publisher: { slug: string }) {
  return `${env.PUBLIC_URL}/publishers/${publisher.slug}`
}

export function link(url: string | null | undefined, title?: string) {
  return url ? b.link(url, title) : undefined
}

export function repositoryLink(repository: string | null) {
  return repository ? b.link(`https://github.com/${repository}`, repository) : undefined
}
