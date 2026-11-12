import { z } from "zod"
import { MAX_SCREENSHOTS } from "./listing-toml.ts"

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024

const configPath = z
  .string()
  .min(1)
  .max(300)
  .regex(/^(?!\/)[^\\:]+$/, "A path from the repository root")

export const configMedia = z.object({
  path: configPath,
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "A SHA-256 is 64 lowercase hex digits"),
  size: z.number().int().positive().max(MAX_MEDIA_BYTES),
})
export type ConfigMedia = z.infer<typeof configMedia>

export const applyRequest = z.object({
  schelf_toml: z.string().max(20_000),
  schelf_toml_path: configPath.default("schelf.toml"),
  listing_toml: z.string().max(60_000).optional(),
  media: z
    .array(configMedia)
    .max(MAX_SCREENSHOTS + 1)
    .default([]),
  dry_run: z.boolean().default(false),
  host: z.string().trim().max(100).optional(),
})
export type ApplyRequest = z.input<typeof applyRequest>

export interface ConfigChange {
  file: string
  key: string
  change: string
}

export interface ConfigFiles {
  schelf_toml: string | null
  listing_toml: string | null
  applied_at: string | null
}

export interface ApplyResponse {
  app: string
  applied: boolean
  changes: ConfigChange[]
  missing_media: string[]
  review: string[]
  notes: string[]
  request: { id: string; url: string; expires_at: string } | null
}
