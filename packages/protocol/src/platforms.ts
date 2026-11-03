import { z } from "zod"

export const PLATFORMS = [
  "linux-x86_64",
  "linux-aarch64",
  "windows-x86_64",
  "windows-aarch64",
  "macos-aarch64",
  "luft",
  "luft-x86_64",
  "luft-aarch64",
] as const
export const platform = z.enum(PLATFORMS)
export type Platform = z.infer<typeof platform>

export const APP_PLATFORMS = PLATFORMS.filter((name) => !name.startsWith("luft"))
export const EXTENSION_PLATFORMS = PLATFORMS.filter((name) => name.startsWith("luft"))

export const KINDS = ["app", "extension"] as const
export const kind = z.enum(KINDS)
export type Kind = z.infer<typeof kind>

export const FORMATS = ["sabine", "appimage", "luft-extension"] as const
export const format = z.enum(FORMATS)
export type Format = z.infer<typeof format>

export const SABINE_ARTIFACT_KINDS = ["archive", "deb", "rpm", "msi", "exe", "dmg", "app-image"] as const
export const ARTIFACT_KINDS = [...SABINE_ARTIFACT_KINDS, "appimage", "extension"] as const
export const artifactKind = z.enum(ARTIFACT_KINDS)
export type ArtifactKind = z.infer<typeof artifactKind>

export const DISTRIBUTIONS = ["open", "proprietary"] as const
export const distribution = z.enum(DISTRIBUTIONS)

export const ACCESS = ["full", "limited"] as const
export const access = z.enum(ACCESS)
export type Access = z.infer<typeof access>

export function platformsFor(appKind: Kind): readonly Platform[] {
  return appKind === "extension" ? EXTENSION_PLATFORMS : APP_PLATFORMS
}

export function formatFits(appKind: Kind, appFormat: Format) {
  return appKind === "extension" ? appFormat === "luft-extension" : appFormat !== "luft-extension"
}

const APP_ID = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+){2,}$/

export const appId = z.string().max(255).regex(APP_ID, "An app id is reverse DNS, like io.github.alice.Notes")

export function sameAppId(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase()
}

export function namespaceCovers(prefix: string, id: string) {
  return id.toLowerCase().startsWith(`${prefix.toLowerCase()}.`)
}
