import { z } from "zod"
import { access, format, kind, platform } from "../platforms.ts"

export const publisherSummary = z.object({
  name: z.string(),
  slug: z.string(),
  verified: z.boolean(),
})
export type PublisherSummary = z.infer<typeof publisherSummary>

export const platformRelease = z.object({
  version: z.string(),
  format,
  size: z.number().int().nonnegative(),
  rollout: z.number().int().min(0).max(100),
})
export type PlatformRelease = z.infer<typeof platformRelease>

export const catalogEntry = z.object({
  id: z.string(),
  kind,
  name: z.string(),
  summary: z.string(),
  icon: z.string().nullable(),
  categories: z.array(z.string()),
  publisher: publisherSummary,
  platforms: z.partialRecord(platform, platformRelease),
  access,
  updated: z.iso.datetime(),
  installs_30d: z.number().int().nonnegative(),
})
export type CatalogEntry = z.infer<typeof catalogEntry>

export function comingSoon(entry: Pick<CatalogEntry, "platforms">) {
  return Object.keys(entry.platforms).length === 0
}

export const catalog = z.object({
  version: z.literal(1),
  generated: z.iso.datetime(),
  apps: z.array(catalogEntry),
})
export type Catalog = z.infer<typeof catalog>

export const MIRROR_ORIGINS = ["flathub", "fedora"] as const
export const mirrorOrigin = z.enum(MIRROR_ORIGINS)
export type MirrorOrigin = z.infer<typeof mirrorOrigin>

const mirrorBase = z.object({
  id: z.string(),
  kind: z.literal("app"),
  name: z.string(),
  summary: z.string(),
  icon: z.string().nullable(),
  categories: z.array(z.string()),
  publisher: z.object({ name: z.string(), verified: z.boolean() }),
  updated: z.iso.datetime(),
  installs_30d: z.number().int().nonnegative(),
  rank: z.number(),
})

export const mirrorEntry = z.discriminatedUnion("origin", [
  mirrorBase.extend({ origin: z.literal("flathub"), flathub: z.string() }),
  mirrorBase.extend({ origin: z.literal("fedora"), package: z.string() }),
])
export type MirrorEntry = z.infer<typeof mirrorEntry>

export const mirrorCatalog = z.object({
  version: z.literal(1),
  generated: z.iso.datetime(),
  origin: mirrorOrigin,
  apps: z.array(mirrorEntry),
})
export type MirrorCatalog = z.infer<typeof mirrorCatalog>
