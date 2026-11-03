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

export const APP_STATUSES = ["draft", "in-review", "listed", "delisted", "pulled"] as const
export const appStatus = z.enum(APP_STATUSES)
export type AppStatus = z.infer<typeof appStatus>

export const ORIGINS = ["oidc", "token"] as const
export const origin = z.enum(ORIGINS)
export type Origin = z.infer<typeof origin>

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
