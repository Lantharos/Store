export type Packages = Map<string, string>

const TOML_PACKAGE = /\[\[package\]\]\s*\nname\s*=\s*"([^"]+)"\s*\nversion\s*=\s*"([^"]+)"/g
const BUN_PACKAGE = /^\s*"[^"]+":\s*\["((?:@[^/"]+\/)?[^@"]+)@([^"]+)"/gm
const YARN_PACKAGE = /^"?((?:@[^/"\s]+\/)?[^@"\s]+)@[^\n]*:\n\s+version:? "?([^"\n]+)"?/gm
const PNPM_PACKAGE = /^ {2}'?\/?((?:@[^/'\s]+\/)?[^@'\s]+)@([^:'(\s]+)/gm
const GO_REQUIRE = /^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]{2,}\/\S+)\s+(v\S+)/gm
const REQUIREMENT = /^([A-Za-z0-9._-]+)==([^\s;#]+)/gm

function collect(text: string, pattern: RegExp): Packages {
  return new Map([...text.matchAll(pattern)].map((match) => [match[1]!, match[2]!]))
}

function packageLock(text: string): Packages {
  const lock = JSON.parse(text) as { packages?: Record<string, { version?: string }> }
  return new Map(
    Object.entries(lock.packages ?? {})
      .filter(([path, entry]) => path.includes("node_modules/") && entry.version)
      .map(([path, entry]) => [
        path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length),
        entry.version!,
      ]),
  )
}

const LOCKFILES: [RegExp, (text: string) => Packages][] = [
  [/(^|\/)(Cargo\.lock|poetry\.lock|uv\.lock)$/, (text) => collect(text, TOML_PACKAGE)],
  [/(^|\/)package-lock\.json$/, packageLock],
  [/(^|\/)bun\.lock$/, (text) => collect(text, BUN_PACKAGE)],
  [/(^|\/)yarn\.lock$/, (text) => collect(text, YARN_PACKAGE)],
  [/(^|\/)pnpm-lock\.yaml$/, (text) => collect(text, PNPM_PACKAGE)],
  [/(^|\/)go\.mod$/, (text) => collect(text, GO_REQUIRE)],
  [/(^|\/)requirements[^/]*\.txt$/, (text) => collect(text, REQUIREMENT)],
]

export const isLockfile = (path: string) => LOCKFILES.some(([pattern]) => pattern.test(path))

export function readPackages(path: string, text: string): Packages {
  return LOCKFILES.find(([pattern]) => pattern.test(path))![1](text)
}

const major = (version: string) => {
  const parts = version.replace(/^[v=^~]/, "").split(".")
  return parts[0] === "0" ? `0.${parts[1] ?? ""}` : parts[0]
}

export interface DependencyChanges {
  added: string[]
  removed: string[]
  majorBumps: string[]
}

export function compareDependencies(before: Packages, after: Packages): DependencyChanges {
  const added = [...after]
    .filter(([name]) => !before.has(name))
    .map(([name, version]) => `${name} ${version}`)
  const removed = [...before]
    .filter(([name]) => !after.has(name))
    .map(([name, version]) => `${name} ${version}`)
  const majorBumps = [...after]
    .filter(([name, version]) => before.has(name) && major(before.get(name)!) !== major(version))
    .map(([name, version]) => `${name} ${before.get(name)} → ${version}`)
  return { added, removed, majorBumps }
}
