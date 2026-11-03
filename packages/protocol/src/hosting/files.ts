import type { ArtifactKind, Platform } from "../platforms.ts"

type FileKind = Extract<
  ArtifactKind,
  | "exe"
  | "msi"
  | "dmg"
  | "pkg"
  | "deb"
  | "rpm"
  | "flatpak"
  | "appimage"
  | "apk"
  | "zip"
  | "tarball"
  | "binary"
>
type Os = "windows" | "macos" | "linux" | "android"

const EXTENSIONS: [RegExp, FileKind][] = [
  [/\.exe$/i, "exe"],
  [/\.msi$/i, "msi"],
  [/\.dmg$/i, "dmg"],
  [/\.pkg$/i, "pkg"],
  [/\.deb$/i, "deb"],
  [/\.rpm$/i, "rpm"],
  [/\.flatpak$/i, "flatpak"],
  [/\.appimage$/i, "appimage"],
  [/\.apk$/i, "apk"],
  [/\.zip$/i, "zip"],
  [/\.(tar\.(gz|xz|zst|bz2)|tgz|txz|tbz2)$/i, "tarball"],
  [/^[^.]+$|\.(bin|run)$/i, "binary"],
]

const KIND_OS: Partial<Record<FileKind, Os>> = {
  exe: "windows",
  msi: "windows",
  dmg: "macos",
  pkg: "macos",
  deb: "linux",
  rpm: "linux",
  flatpak: "linux",
  appimage: "linux",
  apk: "android",
}

const OS_IN_NAME: [RegExp, Os][] = [
  [/(^|[-_.])(windows|win|win32|win64)([-_.]|$)/i, "windows"],
  [/(^|[-_.])(macos|mac|osx|darwin|apple)([-_.]|$)/i, "macos"],
  [/(^|[-_.])(linux)([-_.]|$)/i, "linux"],
  [/(^|[-_.])(android)([-_.]|$)/i, "android"],
]

const ARCH_IN_NAME: [RegExp, "x86_64" | "aarch64" | "universal"][] = [
  [/(^|[-_.])(x86_64|x86-64|amd64|x64)([-_.]|$)/i, "x86_64"],
  [/(^|[-_.])(aarch64|arm64)([-_.]|$)/i, "aarch64"],
  [/(^|[-_.])(universal)([-_.]|$)/i, "universal"],
]

export class UnknownFile extends Error {}

export function fileKindOf(name: string): FileKind {
  const found = EXTENSIONS.find(([pattern]) => pattern.test(name))
  if (!found) throw new UnknownFile(`Schelf doesn't host ${name.slice(name.lastIndexOf("."))} files`)
  return found[1]
}

function platformOf(os: Os | undefined, arch: string | undefined): Platform {
  if (os === "android") return "android"
  if (!os) return "any"
  if (os === "macos")
    return arch === "universal" ? "macos-universal" : (`macos-${arch ?? "x86_64"}` as Platform)
  return `${os}-${arch === "aarch64" ? "aarch64" : "x86_64"}`
}

export function inferFile(name: string): { kind: FileKind; platform: Platform } {
  const kind = fileKindOf(name)
  const os = KIND_OS[kind] ?? OS_IN_NAME.find(([pattern]) => pattern.test(name))?.[1]
  const arch = ARCH_IN_NAME.find(([pattern]) => pattern.test(name))?.[1]
  return { kind, platform: platformOf(os, arch) }
}

export const UPDATER_SIGNATURE = /\.sig$/i
export const GENERATED_FEEDS = [/\.blockmap$/i, /^latest(-[a-z0-9]+)*\.yml$/i]
