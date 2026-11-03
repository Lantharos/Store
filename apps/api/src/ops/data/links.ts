import { env } from "cloudflare:workers"
import { b } from "@lantharos/pult"

export function appPage(app: { id: string; kind: "app" | "extension"; status: string }) {
  if (app.status !== "listed") return undefined
  return `${env.PUBLIC_URL}/${app.kind === "extension" ? "extensions" : "apps"}/${app.id}`
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
