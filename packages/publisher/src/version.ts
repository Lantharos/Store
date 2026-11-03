import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { channelFromVersion, type Format, NIGHTLY, nightlyVersion, versionFromTag } from "@schelf/protocol"
import { parse } from "smol-toml"

type Versioned = { version?: string; package?: { version?: string }; app?: { version?: string } }

const MANIFESTS: Record<Format, string[]> = {
  sabine: ["Sabine.toml"],
  "luft-extension": ["extension.toml"],
  appimage: ["src-tauri/tauri.conf.json", "tauri.conf.json", "package.json"],
  files: ["src-tauri/tauri.conf.json", "tauri.conf.json", "package.json"],
}

const versionIn = (name: string, text: string) => {
  const manifest = (name.endsWith(".toml") ? parse(text) : JSON.parse(text)) as Versioned
  return manifest.app?.version ?? manifest.version ?? manifest.package?.version
}

export async function manifestVersion(folder: string, format: Format) {
  for (const name of MANIFESTS[format]) {
    const text = await readFile(join(folder, name), "utf8").catch(() => undefined)
    const version = text && versionIn(name, text)
    if (version) return version
  }
  throw new Error(`No version in ${MANIFESTS[format].join(" or ")}; set one there or pass the version`)
}

export interface VersionSource {
  version?: string
  folder: string
  format: Format
  tag?: string
  commit?: string
  channel?: string
}

export async function releaseVersion(source: VersionSource, now = new Date()) {
  if (source.version) return source.version.replace(/^v/, "")
  const base =
    (source.tag && versionFromTag(source.tag)) || (await manifestVersion(source.folder, source.format))
  if (source.channel !== NIGHTLY || channelFromVersion(base) === NIGHTLY) return base
  if (!source.commit) throw new Error("A nightly version names its commit; run this in a git checkout")
  return nightlyVersion(base, source.commit, now)
}
