export type Os = "windows" | "macos" | "linux" | "luft" | "phone" | "other"
export type Arch = "x86_64" | "aarch64"

export interface System {
  os: Os
  arch: Arch
}

const PHONE = /Android|iPhone|iPad|iPod|CrOS/
const LUFT = /\bLuft\b/

function osFrom(agent: string, platformHint: string | null): Os {
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

export function detect(agent: string, platformHint: string | null = null, archHint: string | null = null): System {
  const os = osFrom(agent, platformHint)
  return { os, arch: os === "macos" ? "aarch64" : archFrom(agent, archHint) }
}

export function systemKey(system: System) {
  return `${system.os}-${system.arch}`
}

interface HighEntropy {
  getHighEntropyValues(hints: string[]): Promise<{ architecture?: string; platform?: string }>
}

export async function refine(system: System): Promise<System> {
  const data = (navigator as Navigator & { userAgentData?: HighEntropy }).userAgentData
  if (!data || system.os === "luft" || system.os === "phone") return system
  const values = await data.getHighEntropyValues(["architecture"])
  if (!values.architecture) return system
  return detect(navigator.userAgent, values.platform ?? null, values.architecture)
}

const API_OS: Partial<Record<Os, string>> = { windows: "windows", macos: "macos", linux: "linux", luft: "linux" }

export function platformParam(system: System) {
  const os = API_OS[system.os]
  return os ? `${os}-${system.arch}` : null
}
