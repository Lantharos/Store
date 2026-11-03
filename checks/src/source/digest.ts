import type { DependencyChanges } from "./dependencies.ts"
import { isLockfile } from "./dependencies.ts"

export interface ChangedFile {
  path: string
  status: string
  added: number
  removed: number
  binary: boolean
}

export type Group = "code" | "build" | "dependencies" | "assets"

export interface DiffFacts {
  files: (ChangedFile & { group: Group })[]
  dependencies: DependencyChanges
  newHosts: string[]
  suspicious: { path: string; reason: string }[]
  sensitive: string[]
  digest: string
}

const BUDGET = 24_000
const MANIFESTS =
  /(^|\/)(Cargo\.toml|package\.json|pyproject\.toml|go\.sum|Gemfile(\.lock)?|composer\.(json|lock))$/
const BUILD =
  /(^|\/)(build\.rs|Makefile|CMakeLists\.txt|[^/]+\.cmake|meson\.build|[^/]+\.gradle(\.kts)?|Dockerfile|[^/]+\.spec|Sabine\.toml|schelf\.toml|permissions\.toml|extension\.toml|AppImageBuilder\.ya?ml|electron-builder\.(json|ya?ml)|tauri\.conf\.json|[^/]+\.(sh|ps1|bat|cmd)|\.github\/.*|scripts\/.*)$/
const ASSETS = /\.(png|jpe?g|gif|webp|svg|ico|icns|bmp|ttf|otf|woff2?|mp3|ogg|wav|flac|mp4|webm|po|mo|pdf)$/i
const URL_HOST = /\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})/g
const INSTALL_HOOK = /"(pre|post)?install"\s*:/
const SANDBOX_TABLE = /^\+\s*\[sandbox\]|^[+-]\s*(network|filesystems|devices|talk|unsandboxed)\s*=/m
const MINIFIED_LINE = 400
const ENTROPY_FLOOR_BYTES = 4096
const HIGH_ENTROPY = 5.2

export function groupOf(path: string): Group {
  if (isLockfile(path) || MANIFESTS.test(path)) return "dependencies"
  if (BUILD.test(path)) return "build"
  if (ASSETS.test(path)) return "assets"
  return "code"
}

export function splitPatch(patch: string) {
  const files = new Map<string, string>()
  for (const section of patch.split(/^(?=diff --git )/m)) {
    const path = /^diff --git a\/.+? b\/(.+)$/m.exec(section)?.[1]
    if (path) files.set(path, section)
  }
  return files
}

const changedLines = (patch: string, sign: "+" | "-") =>
  patch
    .split("\n")
    .filter((line) => line.startsWith(sign) && !line.startsWith(`${sign}${sign}${sign}`))
    .map((line) => line.slice(1))

export function entropy(text: string) {
  const counts = new Map<string, number>()
  for (const character of text) counts.set(character, (counts.get(character) ?? 0) + 1)
  let bits = 0
  for (const count of counts.values()) {
    const share = count / text.length
    bits -= share * Math.log2(share)
  }
  return bits
}

function hostsIn(lines: string[]) {
  return new Set(
    lines.flatMap((line) => [...line.matchAll(URL_HOST)].map((match) => match[1]!.toLowerCase())),
  )
}

function suspiciousFiles(files: ChangedFile[], patches: Map<string, string>) {
  const found: { path: string; reason: string }[] = []
  for (const file of files) {
    if (file.status === "D") continue
    if (file.binary && file.status === "A" && groupOf(file.path) !== "assets")
      found.push({ path: file.path, reason: "new binary file" })
    const added = changedLines(patches.get(file.path) ?? "", "+")
    const text = added.join("\n")
    if (added.some((line) => line.length > MINIFIED_LINE))
      found.push({ path: file.path, reason: "minified or generated" })
    else if (text.length >= ENTROPY_FLOOR_BYTES && entropy(text) > HIGH_ENTROPY)
      found.push({ path: file.path, reason: "high entropy, possibly encoded data" })
  }
  return found
}

function sensitiveChanges(files: ChangedFile[], patches: Map<string, string>) {
  return files
    .filter((file) => {
      const patch = patches.get(file.path) ?? ""
      if (groupOf(file.path) === "build") return true
      if (/(^|\/)package\.json$/.test(file.path))
        return INSTALL_HOOK.test(changedLines(patch, "+").join("\n"))
      return SANDBOX_TABLE.test(patch)
    })
    .map((file) => file.path)
}

function riskOrder(facts: Omit<DiffFacts, "digest">, patches: Map<string, string>) {
  const hostFiles = new Set(
    [...patches]
      .filter(([, patch]) => facts.newHosts.some((host) => patch.includes(host)))
      .map(([path]) => path),
  )
  const suspicious = new Set(facts.suspicious.map((entry) => entry.path))
  const rank = (path: string) =>
    facts.sensitive.includes(path)
      ? 0
      : hostFiles.has(path)
        ? 1
        : suspicious.has(path)
          ? 3
          : groupOf(path) === "code"
            ? 2
            : 4
  return facts.files
    .filter((file) => !file.binary && patches.has(file.path) && !isLockfile(file.path))
    .sort(
      (left, right) =>
        rank(left.path) - rank(right.path) || right.added + right.removed - (left.added + left.removed),
    )
}

function list(title: string, items: string[]) {
  return items.length ? `${title}\n${items.map((item) => `  ${item}`).join("\n")}\n\n` : ""
}

export function buildDigest(
  files: ChangedFile[],
  patches: Map<string, string>,
  dependencies: DependencyChanges,
): DiffFacts {
  const removedHosts = hostsIn([...patches.values()].flatMap((patch) => changedLines(patch, "-")))
  const newHosts = [...hostsIn([...patches.values()].flatMap((patch) => changedLines(patch, "+")))]
    .filter((host) => !removedHosts.has(host))
    .sort()
  const facts = {
    files: files.map((file) => ({ ...file, group: groupOf(file.path) })),
    dependencies,
    newHosts,
    suspicious: suspiciousFiles(files, patches),
    sensitive: sensitiveChanges(files, patches),
  }

  const groups = (["code", "build", "dependencies", "assets"] as const).map((group) =>
    list(
      `Changed ${group} files`,
      facts.files
        .filter((file) => file.group === group)
        .map(
          (file) =>
            `${file.status} ${file.path} ${file.binary ? "(binary)" : `+${file.added} -${file.removed}`}`,
        ),
    ),
  )
  let digest = [
    ...groups,
    list("Dependencies added", dependencies.added),
    list("Dependencies removed", dependencies.removed),
    list("Major version bumps", dependencies.majorBumps),
    list("New hosts in code", newHosts),
    list(
      "New binary, minified or encoded files",
      facts.suspicious.map((entry) => `${entry.path}: ${entry.reason}`),
    ),
    list("Build scripts, CI, install hooks and permissions changed", facts.sensitive),
  ].join("")
  if (digest.length > BUDGET) digest = `${digest.slice(0, BUDGET - 40)}\n… the list goes on\n`

  for (const file of riskOrder(facts, patches)) {
    const hunk = patches.get(file.path)!
    const room = BUDGET - digest.length
    if (room < 200) break
    digest += hunk.length <= room ? `${hunk}\n` : `${hunk.slice(0, room - 30)}\n… cut short\n`
  }
  return { ...facts, digest }
}
