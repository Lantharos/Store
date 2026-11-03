import { blank, field, line } from "../ui/output.ts"
import { bold, muted } from "../ui/style.ts"
import type { Validation } from "./validate.ts"

const WIDTH = Math.min(process.stdout.columns ?? 80, 88) - 4
const DESCRIPTION_LINES = 8

export function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let current = ""
    for (const word of paragraph.split(" ")) {
      if (current && current.length + word.length + 1 > width) {
        lines.push(current)
        current = word
      } else {
        current = current ? `${current} ${word}` : word
      }
    }
    lines.push(current)
  }
  return lines
}

export function preview({ listing, access, fullAccess }: Validation) {
  line(bold(listing.name ?? "Unnamed app"))
  if (listing.summary) line(listing.summary)
  const byline = [listing.developer, listing.licence, fullAccess ? "Full access" : "Limited access"]
  line(muted(byline.filter(Boolean).join(" · ")))
  if (listing.description) {
    blank()
    const lines = wrap(listing.description, WIDTH)
    for (const text of lines.slice(0, DESCRIPTION_LINES)) line(text)
    if (lines.length > DESCRIPTION_LINES) line(muted("…"))
  }
  blank()
  const [first = "Nothing beyond its own place on the desktop", ...rest] = access
  field("Permissions", first)
  for (const text of rest) field("", text)
  field("Screenshots", String(listing.screenshots))
  if (listing.categories.length) field("Categories", listing.categories.join(", "))
  if (listing.homepage) field("Homepage", listing.homepage)
  if (listing.support) field("Support", listing.support)
}
