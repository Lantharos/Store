import { z } from "zod"
import { listingText, type Screenshot } from "../files/app.ts"
import type { Permissions } from "../permissions.ts"
import { appId, artifactKind, distribution, format, kind, type Platform, platform } from "../platforms.ts"
import { projectSlug, type Visibility, visibility } from "../projects.ts"
import {
  type AppStatus,
  type CheckResult,
  channelName,
  type Origin,
  type ReleaseStatus,
  type Updater,
  updater,
} from "../releases.ts"
import { SCHELF_WORKFLOW } from "../setup.ts"

export const CLI_CLIENT_ID = "schelf-cli"
export const PROOF_METHODS = ["dns", "well-known", "github"] as const
export type ProofMethod = (typeof PROOF_METHODS)[number]
export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const
export const MAX_ICON_BYTES = 1024 * 1024
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024

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
  slug: string
  publisher: string
  publisher_slug: string
  visibility: Visibility
  listing_requested: boolean
  updater: Updater | null
  kind: z.infer<typeof kind>
  format: z.infer<typeof format>
  name: string
  icon: string | null
  art: string | null
  status: AppStatus
  version: string | null
  release_status: ReleaseStatus | null
  installs_7d: number
}

const repositoryName = z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, "A repository is owner/name")
const workflowPath = z
  .string()
  .regex(/^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/, "A workflow lives in .github/workflows")

const newProjectBase = z.object({
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().max(120).default(""),
  distribution,
  licence: z.string().trim().max(100).optional(),
  repository: repositoryName.optional(),
  workflow: workflowPath.default(SCHELF_WORKFLOW),
  environment: z.string().trim().max(100).optional(),
})

export const createApp = newProjectBase.extend({
  id: appId,
  kind,
  format: format.exclude(["files"]),
  visibility: visibility.default("listed"),
})
export type CreateApp = z.input<typeof createApp>

export const createProject = newProjectBase.extend({
  slug: projectSlug.min(1),
  updater: updater.exclude(["sabine"]).optional(),
})
export type CreateProject = z.input<typeof createProject>

export const updateHosting = z.object({
  slug: projectSlug.min(1).optional(),
  page_indexed: z.boolean().optional(),
  latest_follows_rollout: z.boolean().optional(),
})
export type UpdateHosting = z.infer<typeof updateHosting>

export const listingRequest = z.object({ note: z.string().trim().max(1000).default("") })

export interface Links {
  page: string
  latest: string
  json: string
  embed: string
  feeds: { updater: Updater; url: string }[]
}

export interface DeletedProject {
  id: string
  restorable_until: string | null
}

export interface RestorableProject {
  id: string
  name: string
  kind: z.infer<typeof kind>
  deleted_at: string
  restorable_until: string
}

export interface Channel {
  name: string
  keep: number | null
  releases: number
}
export const updateChannel = z.object({ keep: z.number().int().min(1).max(100).nullable() })
export const promoteRelease = z.object({ channel: channelName })

export interface UpdaterSwitch {
  id: string
  from: Updater
  to: Updater
  from_format: z.infer<typeof format>
  to_format: z.infer<typeof format>
  started_at: string
  first_release: string | null
  bridge_release: string | null
  completed_at: string | null
}
export const startSwitch = z.object({ to: updater })

export const manualUpload = z.object({
  version: z.string().trim().min(1).max(64),
  channel: channelName.optional(),
  notes: z.string().max(20_000).default(""),
  bridge: z.boolean().default(false),
  files: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .max(200)
          .regex(
            /^[A-Za-z0-9][A-Za-z0-9._+-]*$/,
            "File names are letters, digits, dots, dashes and underscores",
          ),
        platform,
        kind: artifactKind,
        size: z.number().int().positive(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        signature: z.string().max(4096).optional(),
      }),
    )
    .min(1)
    .max(20),
})
export type ManualUpload = z.infer<typeof manualUpload>

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
export type UpdateMeta = z.input<typeof updateMeta>

export const updateListing = listingText.extend({ source: listingSource.default("dashboard") })
export type UpdateListing = z.input<typeof updateListing>

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
  ref: string | null
  created_at: string
}

const refPattern = z
  .string()
  .regex(/^refs\/(heads|tags)\/\S+$/, "A ref looks like refs/heads/main or refs/tags/*")

export const addTrustedPublisher = z.object({
  repository: repositoryName,
  workflow: workflowPath,
  environment: z.string().max(100).optional(),
  ref: refPattern.optional(),
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
    page_indexed: boolean
    latest_follows_rollout: boolean
    created_at: string
  }
  links: Links
  channels: Channel[]
  switches: UpdaterSwitch[]
  listing: Record<string, z.infer<typeof listingText>>
  listing_sources: Record<string, FieldSources>
  meta_sources: FieldSources
  meta: ListingMeta
  screenshots: DashboardScreenshot[]
  trusted_publishers: TrustedPublisher[]
  tokens: DashboardToken[]
  setup: SetupFiles
}

export interface ReleaseSummary {
  id: string
  version: string
  channel: string
  ref: string | null
  origin: Origin
  format: z.infer<typeof format>
  updater: Updater | null
  bridge: boolean
  promoted_from: string | null
  status: ReleaseStatus
  rollout_percent: number
  rollout_paused: boolean
  platforms: Platform[]
  created_at: string
  approved_at: string | null
  approved_by: string | null
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
  artifacts: {
    platform: Platform
    kind: z.infer<typeof artifactKind>
    name: string
    size: number
    sha256: string
    url: string
    attestation: string | null
  }[]
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
