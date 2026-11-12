import type { ListingToml } from "@schelf/protocol"
import type { Issue } from "./issues.ts"

const MIN_SCREENSHOTS = 2

export function listingIssues(file: string, listing: ListingToml): Issue[] {
  const issues: Issue[] = []
  const missing = (key: string, message: string) => issues.push({ level: "warning", file, key, message })
  if (!listing.description) missing("description", "No description; review asks for one")
  if (!listing.icon) missing("icon", "No icon")
  const screenshots = listing.screenshots?.length ?? 0
  if (screenshots < MIN_SCREENSHOTS)
    missing(
      "screenshots",
      `${screenshots} screenshot${screenshots === 1 ? "" : "s"}, and review asks for at least ${MIN_SCREENSHOTS}`,
    )
  if (!listing.categories?.length) missing("categories", "No categories")
  if (!listing.homepage) missing("homepage", "No homepage")
  if (!listing.support) missing("support", "No support link")
  return issues
}
