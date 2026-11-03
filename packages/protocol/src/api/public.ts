import { z } from "zod"
import { type AppIndex, DEFAULT_LOCALE } from "../files/app.ts"
import type { CatalogEntry, MirrorEntry } from "../files/catalog.ts"
import { kind, platform } from "../platforms.ts"
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
  id: "popular" | "new" | "updated" | `category:${string}`
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
  status: Extract<AppStatus, "listed" | "delisted" | "pulled">
  installs: Installs
}

export interface DeveloperPage {
  name: string
  slug: string
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
