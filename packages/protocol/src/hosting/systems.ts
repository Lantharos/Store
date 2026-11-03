export type Os = "windows" | "macos" | "linux" | "luft" | "android" | "phone" | "other"
export type Arch = "x86_64" | "aarch64"

export interface System {
  os: Os
  arch: Arch
}

const ANDROID = /Android/
const PHONE = /iPhone|iPad|iPod|CrOS/
const LUFT = /\bLuft\b/

function osFrom(agent: string, platformHint: string | null): Os {
  if (ANDROID.test(agent)) return "android"
  if (PHONE.test(agent)) return "phone"
  if (LUFT.test(agent)) return "luft"
  const hint = platformHint?.replaceAll('"', "")
  if (hint === "Windows" || /Windows/.test(agent)) return "windows"
  if (hint === "macOS" || /Macintosh|Mac OS X/.test(agent)) return "macos"
  if (hint === "Linux" || /Linux|X11/.test(agent)) return "linux"
  return "other"
}

function archFrom(agent: string, archHint: string | null): Arch {
  const hint = archHint?.replaceAll('"', "")
  if (hint === "arm" || /aarch64|arm64|ARM64/.test(agent)) return "aarch64"
  return "x86_64"
}

export function detect(
  agent: string,
  platformHint: string | null = null,
  archHint: string | null = null,
): System {
  const os = osFrom(agent, platformHint)
  return { os, arch: os === "macos" ? "aarch64" : archFrom(agent, archHint) }
}

export function systemKey(system: System) {
  return `${system.os}-${system.arch}`
}

const API_OS: Partial<Record<Os, string>> = {
  windows: "windows",
  macos: "macos",
  linux: "linux",
  luft: "linux",
}

export function linkTarget(system: System) {
  if (system.os === "android") return "android"
  const os = API_OS[system.os]
  return os ? `${os}-${system.arch}` : null
}

export function platformParam(system: System) {
  const os = API_OS[system.os]
  return os ? `${os}-${system.arch}` : null
}
