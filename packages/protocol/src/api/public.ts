import { z } from "zod"
import { type AppIndex, DEFAULT_LOCALE } from "../files/app.ts"
import type { CatalogEntry, MirrorEntry } from "../files/catalog.ts"
import { type ArtifactKind, kind, type Platform, platform } from "../platforms.ts"
import type { AppStatus } from "../releases.ts"

export const API_BASE = "/api/v1"

export const searchQuery = z.object({
  q: z.string().trim().max(100).default(""),
  locale: z.string().default(DEFAULT_LOCALE),
  platform: platform.optional(),
  kind: kind.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
})
export type SearchQuery = z.infer<typeof searchQuery>

export type SearchHit = ({ origin: "schelf" } & CatalogEntry) | MirrorEntry
export interface SearchResponse {
  results: SearchHit[]
}

export const featuredQuery = z.object({
  locale: z.string().default(DEFAULT_LOCALE),
  platform: platform.optional(),
})
export type FeaturedQuery = z.infer<typeof featuredQuery>

export interface FeaturedSection {
  id: "popular" | "updated" | "coming-soon"
  title: string
  apps: CatalogEntry[]
}
export interface FeaturedResponse {
  sections: FeaturedSection[]
  categories: { name: string; count: number }[]
}

export interface Installs {
  last_30_days: number
  total: number
}

export interface AppPage {
  app: AppIndex
  status: Extract<AppStatus, "published" | "delisted" | "pulled">
  installs: Installs
  project: ProjectSummary
}

export interface ProjectSummary {
  publisher: string
  slug: string
  listed: boolean
  indexed: boolean
  updates: boolean
  page: string
  latest: string
}

export interface ProjectFile {
  version: string
  name: string
  platform: Platform
  kind: ArtifactKind
  size: number
  sha256: string
  url: string
  link: string
  attestation: string | null
}

export interface ProjectDownloads {
  project: string
  name: string
  channel: string
  version: string
  published: string
  notes: string
  page: string
  files: ProjectFile[]
}

export interface PublisherPage {
  name: string
  slug: string
  kind: "person" | "organisation"
  description: string
  website: string | null
  logo: string | null
  verified: boolean
  apps: CatalogEntry[]
}

export const REPORT_KINDS = ["dsa", "dmca", "abuse", "security"] as const
export const reportRequest = z.object({
  app: z.string(),
  kind: z.enum(REPORT_KINDS),
  reason: z.string().trim().min(1).max(200),
  explanation: z.string().trim().min(1).max(5000),
  location: z.string().trim().max(500).optional(),
  name: z.string().trim().max(200).optional(),
  email: z.email().optional(),
})
export type ReportRequest = z.infer<typeof reportRequest>
export interface ReportResponse {
  id: string
}

export interface ApiError {
  error: string
  issues?: { path: string; message: string }[]
}
