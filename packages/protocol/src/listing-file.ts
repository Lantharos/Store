import { parse } from "smol-toml"
import type { z } from "zod"
import { updateMeta } from "./api/dashboard.ts"
import { listingText } from "./files/app.ts"

export const LISTING_TOML = "listing.toml"

export const listingFile = listingText
  .pick({ summary: true, description: true, keywords: true })
  .partial()
  .extend(
    updateMeta.pick({ categories: true, homepage: true, support: true, privacy_url: true, brand_color: true })
      .shape,
  )
export type ListingFile = z.infer<typeof listingFile>

export function readListingFile(text: string): ListingFile {
  return listingFile.parse(parse(text))
}
