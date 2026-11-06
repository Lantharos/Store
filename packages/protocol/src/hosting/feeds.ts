import type { ArtifactKind, Platform } from "../platforms.ts"
import { STABLE } from "../releases.ts"
import { type HostedFile, type HostedRelease, type LinkOptions, pickFile } from "./pick.ts"

export interface TauriFeed {
  version: string
  notes: string
  pub_date: string
  platforms: Record<string, { signature: string; url: string }>
}

const TAURI_OS: Record<string, string> = { windows: "windows", macos: "darwin", linux: "linux" }
const TAURI_BUNDLES: Partial<Record<ArtifactKind, string>> = {
  exe: "nsis",
  msi: "msi",
  appimage: "appimage",
  deb: "deb",
  rpm: "rpm",
  tarball: "app",
}

function tauriTargets(platform: Platform) {
  const [os, arch] = platform.split("-")
  const tauriOs = os && TAURI_OS[os]
  if (!tauriOs || !arch) return []
  const arches = arch === "universal" ? ["x86_64", "aarch64"] : [arch]
  return arches.map((each) => `${tauriOs}-${each}`)
}

export function updaterRelease(releases: HostedRelease[], updater: string, options: LinkOptions) {
  return releases.find(
    (release) =>
      release.updater === updater &&
      (release.rollout === 100 || (options.followRollout && release.rollout > options.draw * 100)),
  )
}

export function tauriFeed(release: HostedRelease): TauriFeed | null {
  const platforms: TauriFeed["platforms"] = {}
  const signed = release.files.filter((file) => file.signature && TAURI_BUNDLES[file.kind])
  for (const target of new Set(signed.flatMap((file) => tauriTargets(file.platform)))) {
    const candidates = signed.filter((file) => tauriTargets(file.platform).includes(target))
    for (const file of candidates)
      platforms[`${target}-${TAURI_BUNDLES[file.kind]}`] = { signature: file.signature!, url: file.url }
    const preferred = pickFile(candidates, candidates[0]!.platform)!
    platforms[target] = { signature: preferred.signature!, url: preferred.url }
  }
  if (!Object.keys(platforms).length) return null
  return { version: release.version, notes: release.notes, pub_date: release.published, platforms }
}

const ELECTRON_FILES: Record<string, { platforms: Platform[]; kinds: ArtifactKind[] }> = {
  "": { platforms: ["windows-x86_64", "windows-aarch64"], kinds: ["exe"] },
  "-mac": { platforms: ["macos-universal", "macos-aarch64", "macos-x86_64"], kinds: ["zip", "dmg"] },
  "-linux": { platforms: ["linux-x86_64"], kinds: ["appimage", "deb", "rpm"] },
  "-linux-arm64": { platforms: ["linux-aarch64"], kinds: ["appimage", "deb", "rpm"] },
}

const ELECTRON_FEED = /^([a-z][a-z0-9-]*?)(-mac|-linux-arm64|-linux)?\.yml$/

export function electronFeedName(file: string) {
  const match = ELECTRON_FEED.exec(file)
  if (!match) return null
  return { channel: match[1] === "latest" ? STABLE : match[1]!, files: ELECTRON_FILES[match[2] ?? ""]! }
}

const yamlString = (value: string) => JSON.stringify(value)

export function electronFeed(release: HostedRelease, file: string): string | null {
  const wanted = electronFeedName(file)?.files
  if (!wanted) return null
  const files = release.files
    .filter(
      (candidate): candidate is HostedFile & { sha512: string } =>
        candidate.sha512 !== null &&
        wanted.platforms.includes(candidate.platform) &&
        wanted.kinds.includes(candidate.kind),
    )
    .sort(
      (left, right) =>
        wanted.platforms.indexOf(left.platform) - wanted.platforms.indexOf(right.platform) ||
        wanted.kinds.indexOf(left.kind) - wanted.kinds.indexOf(right.kind),
    )
  const main = files[0]
  if (!main) return null
  return [
    `version: ${yamlString(release.version)}`,
    "files:",
    ...files.flatMap((each) => [
      `  - url: ${yamlString(each.url)}`,
      `    sha512: ${yamlString(each.sha512)}`,
      `    size: ${each.size}`,
      ...(each.blockmapSize ? [`    blockMapSize: ${each.blockmapSize}`] : []),
    ]),
    `path: ${yamlString(main.url)}`,
    `sha512: ${yamlString(main.sha512)}`,
    `releaseDate: ${yamlString(release.published)}`,
    ...(release.rollout < 100 ? [`stagingPercentage: ${release.rollout}`] : []),
    ...(release.notes ? [`releaseNotes: ${yamlString(release.notes)}`] : []),
    "",
  ].join("\n")
}
