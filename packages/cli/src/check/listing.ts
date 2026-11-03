import type { Component } from "@schelf/appstream"
import type { Project } from "../project/detect.ts"
import type { Issue } from "./issues.ts"

export interface Listing {
  name?: string
  summary?: string
  description?: string
  developer?: string
  licence?: string
  icon?: string
  screenshots: number
  categories: string[]
  homepage?: string
  support?: string
  contentRating: boolean
}

const NAME_LIMIT = 60
const SUMMARY_LIMIT = 120
const MIN_SCREENSHOTS = 2

function iconOf(project: Project, component?: Component) {
  if (project.sabine?.icon) return project.sabine.icon
  const icon = component?.icons.find((candidate) => candidate.kind === "remote") ?? component?.icons[0]
  return icon?.value
}

export function readListing(project: Project, extraScreenshots: number): Listing {
  const component = project.appstream?.component
  return {
    name: project.name,
    summary: project.summary,
    description: component?.description || undefined,
    developer: component?.developer,
    licence: project.licence,
    icon: iconOf(project, component),
    screenshots: (component?.screenshots.length ?? 0) + extraScreenshots,
    categories: component?.categories ?? [],
    homepage: component?.urls.homepage,
    support: component?.urls.bugtracker ?? component?.urls.help ?? component?.urls.contact,
    contentRating: component?.contentRating !== undefined,
  }
}

export function listingIssues(listing: Listing): Issue[] {
  const issues: Issue[] = []
  const later = "Add it to the AppStream file, or in the dashboard."
  if (!listing.name) issues.push({ level: "error", message: "The app has no name" })
  else if (listing.name.length > NAME_LIMIT)
    issues.push({ level: "error", message: `The name is longer than ${NAME_LIMIT} characters` })
  if (!listing.summary) issues.push({ level: "error", message: "The app has no summary", hint: later })
  else if (listing.summary.length > SUMMARY_LIMIT)
    issues.push({ level: "error", message: `The summary is longer than ${SUMMARY_LIMIT} characters` })
  if (!listing.description) issues.push({ level: "warning", message: "No description", hint: later })
  if (!listing.icon) issues.push({ level: "warning", message: "No icon", hint: later })
  if (listing.screenshots < MIN_SCREENSHOTS)
    issues.push({
      level: "warning",
      message: `${listing.screenshots} screenshot${listing.screenshots === 1 ? "" : "s"}, and review asks for at least ${MIN_SCREENSHOTS}`,
      hint: later,
    })
  if (!listing.categories.length) issues.push({ level: "warning", message: "No categories", hint: later })
  if (!listing.homepage) issues.push({ level: "warning", message: "No homepage", hint: later })
  if (!listing.support) issues.push({ level: "warning", message: "No support link", hint: later })
  if (!listing.contentRating) issues.push({ level: "warning", message: "No content rating", hint: later })
  if (!listing.licence)
    issues.push({
      level: "warning",
      message: "No licence found",
      hint: "Add a LICENSE file or project_license.",
    })
  return issues
}
