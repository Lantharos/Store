import { z } from "zod"
import { listingText, type Screenshot } from "../files/app.ts"
import type { Permissions } from "../permissions.ts"
import { appId, distribution, format, kind, type Platform, platform } from "../platforms.ts"
import type { AppStatus, CheckResult, Origin, ReleaseStatus } from "../releases.ts"

export const AGREEMENT_VERSION = "2026-11"
export const CLI_CLIENT_ID = "schelf-cli"
export const DEVELOPER_KINDS = ["person", "organisation"] as const
export const PROOF_METHODS = ["dns", "well-known", "github"] as const
export type ProofMethod = (typeof PROOF_METHODS)[number]
export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const
export const MAX_ICON_BYTES = 1024 * 1024
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024

export interface Developer {
  id: string
  name: string
  slug: string
  kind: (typeof DEVELOPER_KINDS)[number]
  github_login: string | null
  agreement_version: string
  status: "active" | "suspended"
}

export interface Account {
  user: { id: string; name: string; email: string; image: string | null }
  developer: Developer | null
  github: string | null
  passkeys: number
  agreement: { current: string; accepted: string | null }
}

export const becomeDeveloper = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(DEVELOPER_KINDS),
  agreement: z.literal(AGREEMENT_VERSION),
})
export type BecomeDeveloper = z.infer<typeof becomeDeveloper>

export interface Namespace {
  prefix: string
  proof: ProofMethod | "manual" | null
  token: string
  verified: boolean
  verified_at: string | null
  checked_at: string | null
  instructions: { dns: string; well_known: string } | null
}

export const claimNamespace = z.object({
  prefix: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "A namespace is a reversed domain, like com.example"),
})
export const verifyNamespace = z.object({ method: z.enum(PROOF_METHODS) })

export interface DashboardApp {
  id: string
  kind: z.infer<typeof kind>
  format: z.infer<typeof format>
  name: string
  icon: string | null
  status: AppStatus
  version: string | null
  release_status: ReleaseStatus | null
  installs_7d: number
}

export const createApp = z.object({
  id: appId,
  kind,
  format,
  repository: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, "A repository is owner/name"),
  workflow: z.string().default(".github/workflows/schelf.yml"),
  environment: z.string().max(100).optional(),
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(120),
})
export type CreateApp = z.infer<typeof createApp>

export interface SetupFiles {
  schelf_toml: string
  workflow_path: string
  workflow_yml: string
}

export interface ListingMeta {
  icon: string | null
  categories: string[]
  homepage: string | null
  support: string | null
  privacy_url: string | null
  content_rating: string | null
  brand_color: string | null
}

export const LISTING_SOURCES = ["appstream", "sabine", "dashboard"] as const
export const listingSource = z.enum(LISTING_SOURCES)
export type ListingSource = z.infer<typeof listingSource>
export type FieldSources = Record<string, ListingSource>

export const updateMeta = z.object({
  source: listingSource.default("dashboard"),
  categories: z.array(z.string().max(40)).max(4).optional(),
  homepage: z.url().nullable().optional(),
  support: z.url().nullable().optional(),
  privacy_url: z.url().nullable().optional(),
  content_rating: z.string().max(40).nullable().optional(),
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  licence: z.string().max(100).nullable().optional(),
  distribution: distribution.optional(),
})
export type UpdateMeta = z.infer<typeof updateMeta>

export const updateListing = listingText.extend({ source: listingSource.default("dashboard") })
export type UpdateListing = z.infer<typeof updateListing>

export interface DashboardScreenshot extends Screenshot {
  id: string
  position: number
}

export const screenshotUpload = z.object({
  platform: platform.optional(),
  caption: z.string().max(200).optional(),
})
export const reorderScreenshots = z.object({ ids: z.array(z.string()) })

export interface TrustedPublisher {
  id: string
  owner_id: string
  repository_id: string
  repository: string
  workflow: string
  environment: string | null
  created_at: string
}

export const addTrustedPublisher = z.object({
  repository: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/),
  workflow: z.string().regex(/^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/),
  environment: z.string().max(100).optional(),
})

export interface DashboardToken {
  id: string
  name: string
  last_used_at: string | null
  expires_at: string
  revoked_at: string | null
}
export const createToken = z.object({ name: z.string().trim().min(1).max(80) })
export interface CreatedToken extends DashboardToken {
  token: string
}

export interface AppSettings {
  app: DashboardApp & {
    repository: string | null
    licence: string | null
    distribution: z.infer<typeof distribution>
    created_at: string
  }
  listing: Record<string, z.infer<typeof listingText>>
  listing_sources: Record<string, FieldSources>
  meta_sources: FieldSources
  meta: ListingMeta
  screenshots: DashboardScreenshot[]
  publishers: TrustedPublisher[]
  tokens: DashboardToken[]
  setup: SetupFiles
}

export interface ReleaseSummary {
  id: string
  version: string
  channel: string
  tag: string | null
  origin: Origin
  status: ReleaseStatus
  rollout_percent: number
  rollout_paused: boolean
  platforms: Platform[]
  created_at: string
  approved_at: string | null
}

export type TimelineStep =
  | { kind: "uploaded"; at: string; origin: Origin; run_url: string | null }
  | { kind: "check"; at: string; check: CheckResult }
  | { kind: "review"; at: string; decision: string | null; reason: string | null }
  | { kind: "rollout"; at: string; percent: number; paused: boolean }

export interface ReleaseDetail extends ReleaseSummary {
  notes: string
  commit: string | null
  run_url: string | null
  permissions: Permissions | null
  permissions_widened: boolean
  artifacts: { platform: Platform; name: string; size: number; sha256: string; attested: boolean }[]
  checks: CheckResult[]
  timeline: TimelineStep[]
  next: string | null
}

export const ROLLOUT_ACTIONS = ["pause", "resume", "set", "all", "rollback"] as const
export const rolloutRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("all") }),
  z.object({ action: z.literal("rollback") }),
  z.object({ action: z.literal("set"), percent: z.number().int().min(1).max(100) }),
])
export type RolloutRequest = z.infer<typeof rolloutRequest>

export const statsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) })
export interface Stats {
  days: { day: string; installs: number; updates: number }[]
  versions: { version: string; installs: number; updates: number }[]
  platforms: { platform: Platform; installs: number; updates: number }[]
  total: { installs: number; updates: number }
}
