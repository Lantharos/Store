import type { SearchHit } from "@schelf/protocol"

export const appHref = (app: { id: string; kind: string }) =>
  app.kind === "extension" ? `/extensions/${app.id}` : `/apps/${app.id}`

export const repositoryUrl = (fullName: string) => `https://github.com/${fullName}`

export function originOf(hit: SearchHit) {
  return hit.origin === "schelf" ? null : "Flathub"
}
