import type { Artifact, ArtifactKind, Platform } from "@schelf/protocol"
import type { System } from "./detect.ts"

export const PLATFORM_NAMES: Record<Platform, string> = {
  "windows-x86_64": "Windows",
  "windows-aarch64": "Windows on Arm",
  "macos-aarch64": "macOS",
  "linux-x86_64": "Linux",
  "linux-aarch64": "Linux on Arm",
  luft: "Luft",
  "luft-x86_64": "Luft",
  "luft-aarch64": "Luft on Arm",
}

export const KIND_NAMES: Record<ArtifactKind, string> = {
  exe: "Installer",
  msi: "Windows Installer package",
  dmg: "Disk image",
  "app-image": "AppImage",
  appimage: "AppImage",
  deb: "Debian and Ubuntu package",
  rpm: "Fedora and openSUSE package",
  archive: "Archive",
  extension: "Extension",
}

const SYSTEM_NAMES = { windows: "Windows", macos: "Mac", linux: "Linux", luft: "Luft" } as const

const PREFERRED: Record<
  "windows" | "macos" | "linux",
  { platforms: (arch: string) => Platform[]; kinds: ArtifactKind[] }
> = {
  windows: {
    platforms: (arch) => (arch === "aarch64" ? ["windows-aarch64", "windows-x86_64"] : ["windows-x86_64"]),
    kinds: ["exe", "msi", "archive"],
  },
  macos: { platforms: () => ["macos-aarch64"], kinds: ["dmg", "archive"] },
  linux: {
    platforms: (arch) => (arch === "aarch64" ? ["linux-aarch64"] : ["linux-x86_64"]),
    kinds: ["app-image", "appimage", "deb", "rpm", "archive"],
  },
}

export function pickArtifact(artifacts: Artifact[], system: System) {
  if (system.os !== "windows" && system.os !== "macos" && system.os !== "linux") return null
  const preference = PREFERRED[system.os]
  for (const target of preference.platforms(system.arch)) {
    for (const wanted of preference.kinds) {
      const match = artifacts.find((artifact) => artifact.platform === target && artifact.kind === wanted)
      if (match) return match
    }
  }
  return null
}

export function systemName(system: System) {
  return system.os in SYSTEM_NAMES ? SYSTEM_NAMES[system.os as keyof typeof SYSTEM_NAMES] : null
}

export function fileName(artifact: Artifact) {
  return decodeURIComponent(artifact.url.slice(artifact.url.lastIndexOf("/") + 1))
}

export function groupByPlatform(artifacts: Artifact[]) {
  const groups = new Map<Platform, Artifact[]>()
  for (const artifact of artifacts)
    groups.set(artifact.platform, [...(groups.get(artifact.platform) ?? []), artifact])
  return [...groups].map(([platform, files]) => ({ platform, name: PLATFORM_NAMES[platform], files }))
}

export function systemsOf(platforms: Iterable<string>) {
  const names = new Set<string>()
  for (const platform of platforms) {
    if (platform.startsWith("windows")) names.add("Windows")
    else if (platform.startsWith("macos")) names.add("macOS")
    else if (platform.startsWith("linux")) names.add("Linux")
    else if (platform.startsWith("luft")) names.add("Luft")
  }
  if (names.has("Linux")) names.add("Luft")
  return ["Luft", "Linux", "Windows", "macOS"].filter((name) => names.has(name))
}

export function schelfLink(id: string) {
  return `schelf:app/${encodeURIComponent(id)}`
}
