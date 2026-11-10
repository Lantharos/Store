import { z } from "zod"
import { extensionAccess } from "../extensions.ts"
import { requires } from "../manifest.ts"
import { permissions } from "../permissions.ts"
import { access, artifactKind, distribution, format, kind, platform } from "../platforms.ts"
import { publisherSummary } from "./catalog.ts"
import { stamp } from "./stamp.ts"

export const DEFAULT_LOCALE = "en"

export const listingText = z.object({
  name: z.string().min(1).max(60),
  summary: z.string().min(1).max(120),
  description: z.string().max(10_000),
  keywords: z.array(z.string().max(40)).max(20),
})
export type ListingText = z.infer<typeof listingText>

export const screenshot = z.object({
  platform: platform.nullable(),
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().nullable(),
})
export type Screenshot = z.infer<typeof screenshot>

export const artifact = z.object({
  platform,
  format,
  kind: artifactKind,
  url: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  attestation: z.string().nullable(),
  executable: z.string().nullable(),
  deltas: z.array(
    z.object({
      from: z.string(),
      url: z.string(),
      size: z.number().int().positive(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
})
export type Artifact = z.infer<typeof artifact>

export const provenance = z.object({
  origin: z.enum(["github-actions", "developer"]),
  repository: z.string().nullable(),
  workflow: z.string().nullable(),
  ref: z.string().nullable(),
  commit: z.string().nullable(),
  run: z.string().nullable(),
})
export type Provenance = z.infer<typeof provenance>

export const indexedRelease = z.object({
  version: z.string(),
  channel: z.string(),
  published: z.iso.datetime(),
  notes: z.string(),
  rollout: z.object({ percent: z.number().int().min(0).max(100), paused: z.boolean() }),
  permissions: permissions.nullable(),
  extension: extensionAccess.nullable(),
  access,
  requires,
  provenance,
  artifacts: z.array(artifact),
})
export type IndexedRelease = z.infer<typeof indexedRelease>

export const appIndex = stamp.extend({
  version: z.literal(1),
  generated: z.iso.datetime(),
  id: z.string(),
  kind,
  format,
  publisher: publisherSummary,
  listing: z.record(z.string(), listingText),
  icon: z.string().nullable(),
  screenshots: z.array(screenshot),
  categories: z.array(z.string()),
  homepage: z.string().nullable(),
  support: z.string().nullable(),
  privacy_url: z.string().nullable(),
  content_rating: z.string().nullable(),
  brand_color: z.string().nullable(),
  licence: z.string().nullable(),
  repository: z.string().nullable(),
  distribution,
  replaced_by: z.object({ id: z.string(), note: z.string() }).optional(),
  ended_channels: z.record(z.string(), z.string()).optional(),
  releases: z.array(indexedRelease),
})
export type AppIndex = z.infer<typeof appIndex>

export function releaseFor(index: Pick<AppIndex, "releases">, target: string, deviceDraw: number) {
  return index.releases.find(
    (release) =>
      release.rollout.percent > deviceDraw * 100 &&
      release.artifacts.some((candidate) => candidate.platform === target),
  )
}
