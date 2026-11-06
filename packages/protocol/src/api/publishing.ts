import { z } from "zod"
import { mirrorEntry } from "../files/catalog.ts"
import type { Permissions } from "../permissions.ts"
import { type ArtifactKind, artifactKind, type Platform, platform } from "../platforms.ts"
import { type CheckResult, channelName, checkResult, type ReleaseStatus, SEMVER } from "../releases.ts"

export const OIDC_AUDIENCE = "schelf.store"
export const MULTIPART_THRESHOLD = 95_000_000
export const PART_SIZE = 90 * 1024 * 1024
export const MAX_ARTIFACT_SIZE = 4 * 1024 * 1024 * 1024
export const MAX_BLOCKMAP_BASE64 = 8 * 1024 * 1024
export const TOKEN_PREFIX = "schelf_"
export const UPLOAD_TOKEN_HOURS = 1

export function partsFor(size: number) {
  return size > MULTIPART_THRESHOLD ? Math.ceil(size / PART_SIZE) : 1
}

export const publishFile = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/, "File names are letters, digits, dots, dashes and underscores"),
  platform,
  kind: artifactKind,
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "A SHA-256 is 64 lowercase hex digits"),
  executable: z.string().max(500).optional(),
  signature: z.string().max(4096).optional(),
  blockmap: z.base64().max(MAX_BLOCKMAP_BASE64).optional(),
})
export type PublishFile = z.infer<typeof publishFile>

export const publishRequest = z.object({
  version: z.string().max(64).regex(SEMVER, "A version looks like 1.2.0 or 2.0.0-beta.1"),
  commit: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  schelf_toml: z.string().max(20_000),
  permissions_toml: z.string().max(20_000).optional(),
  listing_toml: z.string().max(20_000).optional(),
  notes: z.string().max(20_000).default(""),
  channel: channelName.optional(),
  bridge: z.boolean().default(false),
  files: z.array(publishFile).min(1).max(20),
})
export type PublishRequest = z.infer<typeof publishRequest>

export const promoteRequest = z.object({
  version: z.string().max(64).regex(SEMVER, "A version looks like 1.2.0 or 2.0.0-beta.1"),
  channel: channelName,
  notes: z.string().max(20_000).optional(),
})
export type PromoteRequest = z.infer<typeof promoteRequest>

export interface PublishedRelease {
  release: string
  version: string
  channel: string
  status: ReleaseStatus
  commit: string | null
  created: string
}

export interface PublishedReleases {
  app: string
  releases: PublishedRelease[]
}

export interface UploadTarget {
  name: string
  url: string
  parts: number
  part_size: number
}

export interface PublishResponse {
  release: string
  app: string
  version: string
  channel: string
  status: ReleaseStatus
  dashboard: string
  upload_token: string
  expires: string
  files: UploadTarget[]
}

export interface UploadResponse {
  name: string
  part: number | null
  received: number
}

export interface CompleteResponse {
  release: string
  status: ReleaseStatus
  checks: CheckResult[]
  dashboard: string
}

export const checksReport = z.object({
  checks: z.array(checkResult).min(1),
  facts: z.record(z.string(), z.unknown()).default({}),
})
export type ChecksReport = z.infer<typeof checksReport>
export interface ChecksResponse {
  status: ReleaseStatus
}

export interface ChecksDispatch {
  release: string
  app: string
  version: string
  repository: string | null
  scrutiny: { source: "open" | "closed"; strict: boolean }
  commit: string | null
  previous_commit: string | null
  permissions: Permissions | null
  files: { name: string; platform: Platform; kind: ArtifactKind; url: string; sha256: string }[]
  callback: string
}

export interface DeltaReport {
  platform: Platform
  from: string
  url: string
  size: number
  sha256: string
}

export const mirrorRequest = z.object({
  flathub: z.array(mirrorEntry),
  fedora: z.array(mirrorEntry),
})
export type MirrorRequest = z.infer<typeof mirrorRequest>
export interface MirrorResponse {
  flathub: number
  fedora: number
}
