import { z } from "zod"
import { mirrorEntry } from "../files/catalog.ts"
import { artifactKind, platform } from "../platforms.ts"
import { type CheckResult, checkResult, type ReleaseStatus } from "../releases.ts"

export const OIDC_AUDIENCE = "schelf.store"
export const MULTIPART_THRESHOLD = 95_000_000
export const PART_SIZE = 90 * 1024 * 1024
export const MAX_ARTIFACT_SIZE = 4 * 1024 * 1024 * 1024
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
})
export type PublishFile = z.infer<typeof publishFile>

export const publishRequest = z.object({
  tag: z.string().min(1).max(200),
  version: z.string().min(1).max(64).optional(),
  commit: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .optional(),
  schelf_toml: z.string().max(20_000),
  permissions_toml: z.string().max(20_000).optional(),
  notes: z.string().max(20_000).default(""),
  files: z.array(publishFile).min(1).max(20),
})
export type PublishRequest = z.infer<typeof publishRequest>

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

export const deltaReport = z.object({
  platform,
  from: z.string(),
  key: z.string(),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

export const checksReport = z.object({
  checks: z.array(checkResult).min(1),
  deltas: z.array(deltaReport).default([]),
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
  tag: string | null
  previous_tag: string | null
  files: { name: string; platform: string; url: string; sha256: string }[]
  callback: string
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
