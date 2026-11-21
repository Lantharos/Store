import { z } from "zod"
import { access, format, kind, platform } from "../project/platforms.ts"
import { stamp } from "./stamp.ts"

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
  art: z.string().nullable(),
  categories: z.array(z.string()),
  publisher: publisherSummary,
  platforms: z.partialRecord(platform, platformRelease),
  access,
  updated: z.iso.datetime(),
  installs_30d: z.number().int().nonnegative(),
})
export type CatalogEntry = z.infer<typeof catalogEntry>

export const catalog = stamp.extend({
  version: z.literal(1),
  generated: z.iso.datetime(),
  apps: z.array(catalogEntry),
})
export type Catalog = z.infer<typeof catalog>

export const mirrorIcon = z.url({ protocol: /^https$/ })

export const mirrorEntry = z.object({
  origin: z.literal("flathub"),
  flathub: z.string(),
  id: z.string(),
  kind: z.literal("app"),
  name: z.string(),
  summary: z.string(),
  icon: mirrorIcon.nullable(),
  categories: z.array(z.string()),
  publisher: z.object({ name: z.string(), verified: z.boolean() }),
  updated: z.iso.datetime(),
  installs_30d: z.number().int().nonnegative(),
  rank: z.number(),
})
export type MirrorEntry = z.infer<typeof mirrorEntry>

export const mirrorCatalog = stamp.extend({
  version: z.literal(1),
  generated: z.iso.datetime(),
  origin: z.literal("flathub"),
  apps: z.array(mirrorEntry),
})
export type MirrorCatalog = z.infer<typeof mirrorCatalog>
