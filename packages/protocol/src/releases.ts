import { z } from "zod"

export const RELEASE_STATUSES = [
  "uploading",
  "checking",
  "failed",
  "in-review",
  "changes-requested",
  "rejected",
  "rolling-out",
  "live",
  "withdrawn",
  "pulled",
] as const
export const releaseStatus = z.enum(RELEASE_STATUSES)
export type ReleaseStatus = z.infer<typeof releaseStatus>

export const SHIPPED_STATUSES = ["rolling-out", "live"] as const satisfies ReleaseStatus[]

export const APP_STATUSES = ["draft", "in-review", "published", "delisted", "pulled"] as const
export const appStatus = z.enum(APP_STATUSES)
export type AppStatus = z.infer<typeof appStatus>

export const ORIGINS = ["oidc", "manual"] as const
export const origin = z.enum(ORIGINS)
export type Origin = z.infer<typeof origin>

export const STABLE = "stable"
export const NIGHTLY = "nightly"
export const NIGHTLY_KEEP = 10
export const channelName = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,19}$/, "A channel is a short lowercase name, like beta or nightly")
export const PRERELEASE_CHANNELS: Record<string, string> = {
  alpha: "alpha",
  beta: "beta",
  rc: "beta",
  nightly: NIGHTLY,
  canary: NIGHTLY,
}

export function channelFromVersion(version: string) {
  const word = VERSION.exec(version)?.[4]?.split(/[.-]/)[0]?.toLowerCase()
  return (word && PRERELEASE_CHANNELS[word]) || STABLE
}

export const AUTOMATIC_REVIEWER = "Schelf's checks"

export const UPDATERS = ["sabine", "electron", "tauri"] as const
export const updater = z.enum(UPDATERS)
export type Updater = z.infer<typeof updater>

export const UPDATER_NAMES: Record<Updater, string> = {
  sabine: "Sabine",
  electron: "electron-updater",
  tauri: "Tauri's updater",
}

export const CHECK_STATUSES = ["passed", "warning", "failed"] as const
export const checkStatus = z.enum(CHECK_STATUSES)
export type CheckStatus = z.infer<typeof checkStatus>

export const QUICK_CHECKS = [
  "namespace",
  "version",
  "platforms",
  "files",
  "attestation",
  "listing",
  "permissions",
  "impersonation",
  "extension",
] as const
export const DEEP_CHECKS = ["malware", "inspection", "diff", "licence"] as const
export const CHECK_NAMES = [...QUICK_CHECKS, ...DEEP_CHECKS] as const
export const checkName = z.enum(CHECK_NAMES)
export type CheckName = z.infer<typeof checkName>

export const CHECK_TITLES: Record<CheckName, string> = {
  namespace: "Namespace",
  version: "Version",
  platforms: "Systems",
  files: "Files",
  attestation: "Build provenance",
  listing: "Listing",
  permissions: "Permissions",
  impersonation: "Name and icon",
  extension: "Extension manifest",
  malware: "Malware scan",
  inspection: "What the app can do",
  diff: "Source changes",
  licence: "Licence",
}

export const checkResult = z.object({
  name: checkName,
  status: checkStatus,
  summary: z.string().max(500),
  detail: z.unknown().optional(),
})
export type CheckResult = z.infer<typeof checkResult>

export const ROLLOUT_STEPS = [10, 25, 50, 100] as const
export const ROLLOUT_STEP_HOURS = 24

export function nextRolloutStep(percent: number) {
  return ROLLOUT_STEPS.find((step) => step > percent) ?? 100
}

export function rolloutDue(percent: number, steppedAt: Date, now: Date) {
  return percent < 100 && now.getTime() - steppedAt.getTime() >= ROLLOUT_STEP_HOURS * 3_600_000
}

export function inRollout(percent: number, deviceDraw: number) {
  return deviceDraw * 100 < percent
}

export const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const VERSION = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export function versionFromTag(tag: string) {
  const match = VERSION.exec(tag.slice(tag.lastIndexOf("/") + 1))
  return match ? match[0].replace(/^v/, "") : null
}

export const refName = (ref: string) => ref.replace(/^refs\/(heads|tags)\//, "")

const stamp = (at: Date) => at.toISOString().slice(0, 16).replace(/\D/g, "")

export function nightlyVersion(version: string, commit: string, at: Date) {
  const match = VERSION.exec(version)
  if (!match) throw new Error(`${version} isn't a version`)
  return `${match[1]}.${Number(match[2] ?? 0) + 1}.0-nightly.${stamp(at)}.g${commit.slice(0, 7)}`
}

export function compareVersions(left: string, right: string) {
  const a = VERSION.exec(left)
  const b = VERSION.exec(right)
  if (!a || !b) return left.localeCompare(right)
  for (const index of [1, 2, 3]) {
    const difference = Number(a[index] ?? 0) - Number(b[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  if (a[4] === b[4]) return 0
  if (a[4] === undefined) return 1
  if (b[4] === undefined) return -1
  return a[4].localeCompare(b[4], "en", { numeric: true })
}
