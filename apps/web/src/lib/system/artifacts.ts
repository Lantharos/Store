import {
  type Artifact,
  type ArtifactKind,
  linkTarget,
  type Platform,
  pickFile,
  type System,
} from "@schelf/protocol"

export const PLATFORM_NAMES: Record<Platform, string> = {
  "windows-x86_64": "Windows",
  "windows-aarch64": "Windows on Arm",
  "macos-aarch64": "macOS on Apple silicon",
  "macos-x86_64": "macOS on Intel",
  "macos-universal": "macOS",
  "linux-x86_64": "Linux",
  "linux-aarch64": "Linux on Arm",
  android: "Android",
  any: "Any system",
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
  pkg: "Installer package",
  flatpak: "Flatpak bundle",
  apk: "Android package",
  zip: "Zip archive",
  tarball: "Tar archive",
  binary: "Program",
}

const SYSTEM_NAMES = {
  windows: "Windows",
  macos: "Mac",
  linux: "Linux",
  luft: "Luft",
  android: "Android",
} as const

export function pickArtifact(artifacts: Artifact[], system: System) {
  const target = linkTarget(system)
  return target ? (pickFile(artifacts, target) ?? null) : null
}

export function systemName(system: System) {
  return system.os in SYSTEM_NAMES ? SYSTEM_NAMES[system.os as keyof typeof SYSTEM_NAMES] : null
}

export function fileName(artifact: Artifact) {
  return decodeURIComponent(artifact.url.slice(artifact.url.lastIndexOf("/") + 1))
}

export function groupByPlatform<File extends { platform: Platform; part?: string | null }>(files: File[]) {
  const groups = new Map<string, File[]>()
  for (const file of files) {
    const key = `${file.part ?? ""}/${file.platform}`
    groups.set(key, [...(groups.get(key) ?? []), file])
  }
  return [...groups.values()].map((group) => ({
    key: `${group[0]!.part ?? ""}/${group[0]!.platform}`,
    name: group[0]!.part
      ? `${group[0]!.part} for ${PLATFORM_NAMES[group[0]!.platform]}`
      : PLATFORM_NAMES[group[0]!.platform],
    files: group,
  }))
}

export function systemsOf(platforms: Iterable<string>) {
  const names = new Set<string>()
  for (const platform of platforms) {
    if (platform.startsWith("windows")) names.add("Windows")
    else if (platform.startsWith("macos")) names.add("macOS")
    else if (platform.startsWith("linux")) names.add("Linux")
    else if (platform.startsWith("luft")) names.add("Luft")
    else if (platform === "android") names.add("Android")
  }
  if (names.has("Linux")) names.add("Luft")
  return ["Luft", "Linux", "Windows", "macOS", "Android"].filter((name) => names.has(name))
}

export function schelfLink(id: string) {
  return `schelf:app/${encodeURIComponent(id)}`
}
