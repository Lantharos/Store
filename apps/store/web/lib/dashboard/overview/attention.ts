import { type AppSettings, DEFAULT_LOCALE, type ReleaseSummary } from "@schelf/protocol"
import { list } from "../../format.ts"
import { frameworkName } from "../updates/framework.ts"

export interface Notice {
  title: string
  text: string
  href: string
  action: string
}

const MIN_SCREENSHOTS = 2

function listingGaps(settings: AppSettings) {
  const english = settings.listing[DEFAULT_LOCALE]
  return [
    !english?.description && "a description",
    !settings.meta.icon && "an icon",
    settings.screenshots.length < MIN_SCREENSHOTS && `${MIN_SCREENSHOTS} screenshots`,
    !settings.meta.categories.length && "a category",
  ].filter((gap): gap is string => typeof gap === "string")
}

const NEEDS_A_FIX = new Set(["failed", "changes-requested"])

export function notices(settings: AppSettings, releases: ReleaseSummary[]): Notice[] {
  const app = settings.app
  const base = `/dashboard/apps/${app.id}`
  const found: Notice[] = []
  const shipped = releases.findIndex(
    (release) => release.status === "live" || release.status === "rolling-out",
  )
  for (const release of releases.slice(0, shipped === -1 ? undefined : shipped))
    if (NEEDS_A_FIX.has(release.status))
      found.push({
        title: `${release.version} needs a fix`,
        text:
          release.status === "failed"
            ? "A check failed, so it can't go out. Its page says what to change."
            : "The reviewer asked for changes before it can go out.",
        href: `${base}/releases/${encodeURIComponent(release.id)}`,
        action: "See what's wrong",
      })
  const gaps = app.visibility === "listed" ? listingGaps(settings) : []
  if (gaps.length)
    found.push({
      title: "Finish the listing",
      text: `It still needs ${list(gaps)} before a release can be reviewed.`,
      href: `${base}/listing`,
      action: "Edit the listing",
    })
  const move = settings.switches.find((entry) => !entry.completed_at)
  if (move) {
    const left = [
      !move.first_release && `the first ${frameworkName(move.to)} release`,
      !move.bridge_release && "the bridge",
    ].filter((item): item is string => typeof item === "string")
    found.push({
      title: `Moving to ${frameworkName(move.to)}`,
      text: `Still to ship: ${list(left)}.`,
      href: `${base}/updates`,
      action: "See the move",
    })
  }
  if (app.listing_requested)
    found.push({
      title: "Waiting to be listed",
      text: "A reviewer is looking at the project. You'll get an email when they decide.",
      href: `${base}/settings`,
      action: "Settings",
    })
  return found
}
