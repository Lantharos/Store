import { open, readFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
  type ArtifactKind,
  type Format,
  GENERATED_FEEDS,
  inferFile,
  type Platform,
  platform as platformSchema,
  UnknownFile,
} from "@schelf/protocol"

export interface InferredArtifact {
  path: string
  name: string
  platform: Platform
  kind: ArtifactKind
  executable?: string
  signature?: string
  blockmap?: string
}

const SABINE_NAME =
  /-(linux|windows|macos)-(x86_64|aarch64)(?:-(appimage|deb|rpm|msi|exe|dmg))?\.(appimage|deb|rpm|msi|exe|dmg|tar\.gz|zip)$/i
const SABINE_KINDS: Record<string, ArtifactKind> = {
  appimage: "app-image",
  deb: "deb",
  rpm: "rpm",
  msi: "msi",
  exe: "exe",
  dmg: "dmg",
}
const ELF_MACHINES: Record<number, string> = { 62: "x86_64", 183: "aarch64" }
const ARCH_IN_NAME = /(?:^|[-_.])(x86_64|amd64|x64|aarch64|arm64)(?:[-_.]|$)/i
const IGNORED = [/\.executable$/, /^sabine-update\.json$/, ...GENERATED_FEEDS]

export const ignoredFile = (path: string) => IGNORED.some((pattern) => pattern.test(basename(path)))

export class ArtifactError extends Error {}

async function readExecutable(path: string, target: string) {
  try {
    return (await readFile(join(dirname(path), `${target}.executable`), "utf8")).trim() || undefined
  } catch {
    return undefined
  }
}

async function sabineArtifact(path: string, name: string): Promise<InferredArtifact> {
  const match = SABINE_NAME.exec(name)
  if (!match) {
    throw new ArtifactError(
      `${name} isn't named like a Sabine bundle (…-linux-x86_64-appimage.AppImage). Pass the files Sabine's release workflow uploads.`,
    )
  }
  const [, system, arch, target, extension] = match
  const platform = `${system!.toLowerCase()}-${arch!.toLowerCase()}` as Platform
  const kind = target ? SABINE_KINDS[target.toLowerCase()]! : "archive"
  if (!target && !/^(tar\.gz|zip)$/i.test(extension!)) {
    throw new ArtifactError(`${name} has no package kind after its platform`)
  }
  const updateTarget = target ? `${platform}-${target.toLowerCase()}` : platform
  return { path, name, platform, kind, executable: await readExecutable(path, updateTarget) }
}

export async function elfArchitecture(path: string) {
  const file = await open(path)
  try {
    const header = Buffer.alloc(20)
    await file.read(header, 0, 20, 0)
    if (header.readUInt32BE(0) !== 0x7f454c46) return undefined
    return ELF_MACHINES[header.readUInt16LE(18)]
  } finally {
    await file.close()
  }
}

function architectureInName(name: string) {
  const found = ARCH_IN_NAME.exec(name)?.[1]?.toLowerCase()
  if (!found) return undefined
  return found === "aarch64" || found === "arm64" ? "aarch64" : "x86_64"
}

async function appImageArtifact(path: string, name: string): Promise<InferredArtifact> {
  if (!/\.appimage$/i.test(name)) throw new ArtifactError(`${name} isn't an AppImage`)
  const arch = await elfArchitecture(path)
  if (!arch) throw new ArtifactError(`${name} isn't an x86_64 or aarch64 AppImage`)
  return { path, name, platform: `linux-${arch}` as Platform, kind: "appimage" }
}

function extensionArtifact(path: string, name: string): InferredArtifact {
  if (!/\.tar\.zst$/i.test(name)) throw new ArtifactError(`${name} isn't a .tar.zst of the extension folder`)
  const arch = architectureInName(name.replace(/\.tar\.zst$/i, ""))
  return { path, name, platform: arch ? (`luft-${arch}` as Platform) : "luft", kind: "extension" }
}

async function readBlockmap(path: string) {
  try {
    return (await readFile(`${path}.blockmap`)).toString("base64")
  } catch {
    return undefined
  }
}

async function generalArtifact(path: string, name: string): Promise<InferredArtifact> {
  try {
    const inferred = inferFile(name)
    const linux = inferred.kind === "appimage" || inferred.kind === "binary"
    const arch = linux ? await elfArchitecture(path) : undefined
    return {
      path,
      name,
      kind: inferred.kind,
      platform: arch ? (`linux-${arch}` as Platform) : inferred.platform,
      blockmap: await readBlockmap(path),
    }
  } catch (error) {
    if (error instanceof UnknownFile) throw new ArtifactError(error.message)
    throw error
  }
}

export function inferArtifact(path: string, format: Format): Promise<InferredArtifact> {
  const name = basename(path)
  if (format === "sabine") return sabineArtifact(path, name)
  if (format === "appimage") return appImageArtifact(path, name)
  if (format === "files") return generalArtifact(path, name)
  return Promise.resolve(extensionArtifact(path, name))
}

export function splitPlatform(entry: string) {
  const at = entry.lastIndexOf("#")
  if (at < 0) return { pattern: entry, platform: undefined }
  const parsed = platformSchema.safeParse(entry.slice(at + 1))
  if (!parsed.success) throw new ArtifactError(`${entry.slice(at + 1)} isn't a system Schelf knows`)
  return { pattern: entry.slice(0, at), platform: parsed.data }
}
