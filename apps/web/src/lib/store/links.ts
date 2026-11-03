import type { SearchHit } from "@schelf/protocol"

export const appHref = (app: { id: string; kind: string }) =>
  app.kind === "extension" ? `/extensions/${app.id}` : `/apps/${app.id}`

export const ORIGIN_NAMES = { flathub: "Flathub", fedora: "Fedora" } as const

export function originOf(hit: SearchHit) {
  return hit.origin === "schelf" ? null : ORIGIN_NAMES[hit.origin]
}
