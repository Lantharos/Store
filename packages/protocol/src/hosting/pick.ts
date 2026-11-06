import type { ArtifactKind, Platform } from "../platforms.ts"

export interface HostedFile {
  platform: Platform
  kind: ArtifactKind
  name: string
  url: string
  size: number
  sha256: string
  sha512: string | null
  signature: string | null
  attestation: string | null
}

export interface HostedRelease {
  version: string
  channel: string
  published: string
  notes: string
  rollout: number
  bridge: boolean
  updater: string | null
  files: HostedFile[]
}

const OS_PLATFORMS: Record<string, Platform[]> = {
  windows: ["windows-x86_64", "windows-aarch64"],
  macos: ["macos-universal", "macos-aarch64", "macos-x86_64"],
  linux: ["linux-x86_64", "linux-aarch64"],
  android: ["android"],
}

const FALLBACKS: Partial<Record<Platform, Platform[]>> = {
  "macos-aarch64": ["macos-universal"],
  "macos-x86_64": ["macos-universal"],
  "windows-aarch64": ["windows-x86_64"],
}

const KIND_PREFERENCE: ArtifactKind[] = [
  "exe",
  "msi",
  "dmg",
  "pkg",
  "app-image",
  "appimage",
  "deb",
  "rpm",
  "flatpak",
  "apk",
  "zip",
  "tarball",
  "archive",
  "binary",
  "extension",
]

export function platformCandidates(target: string): Platform[] {
  const forOs = OS_PLATFORMS[target]
  if (forOs) return [...forOs, "any"]
  const platform = target as Platform
  return [platform, ...(FALLBACKS[platform] ?? []), "any"]
}

const APPIMAGE_KINDS: string[] = ["app-image", "appimage"]

const isKind = (file: Pick<HostedFile, "kind">, kind: string) =>
  file.kind === kind || (APPIMAGE_KINDS.includes(kind) && APPIMAGE_KINDS.includes(file.kind))

export function pickFile<T extends Pick<HostedFile, "platform" | "kind">>(
  files: T[],
  target: string,
  kind?: string,
): T | undefined {
  for (const platform of platformCandidates(target)) {
    const matches = files.filter((file) => file.platform === platform && (!kind || isKind(file, kind)))
    if (matches.length)
      return matches.sort(
        (left, right) => KIND_PREFERENCE.indexOf(left.kind) - KIND_PREFERENCE.indexOf(right.kind),
      )[0]
  }
  return undefined
}

export interface LinkOptions {
  followRollout: boolean
  draw: number
}

export function servesLink(release: Pick<HostedRelease, "rollout" | "bridge">, options: LinkOptions) {
  if (release.bridge) return false
  return options.followRollout ? release.rollout > options.draw * 100 : release.rollout === 100
}

function linkedReleases(releases: HostedRelease[], options: LinkOptions) {
  const serving = releases.filter((release) => servesLink(release, options))
  return serving.length ? serving : releases.filter((release) => !release.bridge)
}

export function resolveLink(
  releases: HostedRelease[],
  target: string,
  kind: string | undefined,
  options: LinkOptions,
) {
  for (const release of linkedReleases(releases, options)) {
    const file = pickFile(release.files, target, kind)
    if (file) return { release, file }
  }
  return undefined
}

export function latestRelease(releases: HostedRelease[], options: LinkOptions) {
  return linkedReleases(releases, options)[0]
}
