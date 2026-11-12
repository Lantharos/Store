import { parse } from "smol-toml"
import { z } from "zod"
import { platform } from "../platforms.ts"

export const LISTING_TOML = "listing.toml"
export const MAX_CATEGORIES = 4
export const MAX_SCREENSHOTS = 8
export const MAX_KEYWORDS = 20
export const NAME_LIMIT = 60
export const SUMMARY_LIMIT = 120
export const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

const mediaPath = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^(?!\/)(?!.*(^|\/)\.\.(\/|$))[^\\:]+$/,
    "A path inside the listing folder, like screenshots/main.png",
  )

const words = {
  name: z.string().trim().min(1).max(NAME_LIMIT).describe("The name people see"),
  summary: z.string().trim().min(1).max(SUMMARY_LIMIT).describe("One line that says what it does"),
  description: z
    .string()
    .max(10_000)
    .optional()
    .describe("Plain paragraphs and lists; links and **bold** work"),
  keywords: z
    .array(z.string().trim().min(1).max(40))
    .max(MAX_KEYWORDS)
    .optional()
    .describe("Other words people might search for"),
}

const link = z.url({ protocol: /^https?$/ })

export const screenshotEntry = z.union([
  mediaPath,
  z.strictObject({
    file: mediaPath,
    caption: z.string().trim().max(200).optional(),
    platform: platform.optional().describe("The system the screenshot shows, when it isn't every one"),
  }),
])
export type ScreenshotEntry = z.infer<typeof screenshotEntry>

export const listingToml = z.strictObject({
  ...words,
  categories: z
    .array(z.string().trim().min(1).max(40))
    .max(MAX_CATEGORIES)
    .optional()
    .describe("Up to four; the first is the primary category"),
  homepage: link.optional(),
  support: link.optional().describe("Where people get help or report problems"),
  privacy_url: link.optional().describe("The privacy policy"),
  content_rating: z.string().trim().max(40).optional().describe("An OARS rating, like oars-1.1"),
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "A colour looks like #3e6b4f")
    .optional()
    .describe("Shown behind the app when it's featured"),
  icon: mediaPath.optional().describe("A square SVG, or a square PNG of at least 512 pixels"),
  screenshots: z
    .array(screenshotEntry)
    .max(MAX_SCREENSHOTS)
    .optional()
    .describe("In the order they're shown"),
  listed: z
    .boolean()
    .optional()
    .describe("Ask to be in the catalog, search and Schelf on Luft; a person reviews the request"),
  indexed: z.boolean().optional().describe("Let search engines show an unlisted project's page"),
  translations: z
    .record(
      z.string().regex(LOCALE, "A language looks like de or pt-BR"),
      z.strictObject({ ...words, name: words.name.optional(), summary: words.summary.optional() }),
    )
    .optional()
    .describe("The words in other languages; anything left out falls back to English"),
})
export type ListingToml = z.infer<typeof listingToml>

export function screenshotFile(entry: ScreenshotEntry) {
  return typeof entry === "string" ? { file: entry } : entry
}

export function readListingToml(text: string): ListingToml {
  return listingToml.parse(parse(text))
}

export function joinConfigPath(...parts: string[]) {
  return parts
    .join("/")
    .split("/")
    .filter((segment) => segment && segment !== ".")
    .join("/")
}

export const folderOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "")
