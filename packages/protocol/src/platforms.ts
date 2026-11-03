import { z } from "zod"

export const APP_PLATFORMS = [
  "linux-x86_64",
  "linux-aarch64",
  "windows-x86_64",
  "windows-aarch64",
  "macos-aarch64",
] as const
export const FILE_PLATFORMS = [...APP_PLATFORMS, "macos-x86_64", "macos-universal", "android", "any"] as const
export const EXTENSION_PLATFORMS = ["luft", "luft-x86_64", "luft-aarch64"] as const
export const PLATFORMS = [...FILE_PLATFORMS, ...EXTENSION_PLATFORMS] as const
export const platform = z.enum(PLATFORMS)
export type Platform = z.infer<typeof platform>

export const KINDS = ["app", "extension"] as const
export const kind = z.enum(KINDS)
export type Kind = z.infer<typeof kind>

export const FORMATS = ["sabine", "appimage", "luft-extension", "files"] as const
export const format = z.enum(FORMATS)
export type Format = z.infer<typeof format>

export const SABINE_ARTIFACT_KINDS = ["archive", "deb", "rpm", "msi", "exe", "dmg", "app-image"] as const
export const FILE_KINDS = [
  "exe",
  "msi",
  "dmg",
  "pkg",
  "deb",
  "rpm",
  "flatpak",
  "appimage",
  "apk",
  "zip",
  "tarball",
  "binary",
] as const
export const ARTIFACT_KINDS = [
  ...SABINE_ARTIFACT_KINDS,
  "pkg",
  "flatpak",
  "appimage",
  "apk",
  "zip",
  "tarball",
  "binary",
  "extension",
] as const
export const artifactKind = z.enum(ARTIFACT_KINDS)
export type ArtifactKind = z.infer<typeof artifactKind>

export const DISTRIBUTIONS = ["open", "proprietary"] as const
export const distribution = z.enum(DISTRIBUTIONS)
export type Distribution = z.infer<typeof distribution>

export const ACCESS = ["full", "limited"] as const
export const access = z.enum(ACCESS)
export type Access = z.infer<typeof access>

export function platformsFor(appFormat: Format): readonly Platform[] {
  if (appFormat === "luft-extension") return EXTENSION_PLATFORMS
  return appFormat === "files" ? FILE_PLATFORMS : APP_PLATFORMS
}

export function kindsFor(appFormat: Format): readonly ArtifactKind[] {
  if (appFormat === "sabine") return SABINE_ARTIFACT_KINDS
  if (appFormat === "appimage") return ["appimage"]
  return appFormat === "files" ? FILE_KINDS : ["extension"]
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

export const DELTA_KINDS: Partial<Record<Format, ArtifactKind>> = {
  sabine: "archive",
  appimage: "appimage",
  "luft-extension": "extension",
}
