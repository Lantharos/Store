import type { DashboardPublisher } from "@schelf/protocol"

export interface Section {
  slug: string
  label: string
}

export const SETTINGS = "/dashboard/settings"

export const settingsHref = (slug: string) => `${SETTINGS}/${slug}`

export function publisherSections(publisher: DashboardPublisher): Section[] {
  return [
    { slug: "profile", label: "Profile" },
    ...(publisher.kind === "organisation" ? [{ slug: "members", label: "Members" }] : []),
    { slug: "namespaces", label: "Namespaces" },
    { slug: "verification", label: "Verification" },
  ]
}

export const accountSections: Section[] = [
  { slug: "account", label: "Account" },
  { slug: "appearance", label: "Appearance" },
  { slug: "agreement", label: "Developer agreement" },
]

export function sectionAfterSwitch(path: string, publisher: DashboardPublisher) {
  const slug = path.startsWith(`${SETTINGS}/`) ? path.slice(SETTINGS.length + 1).split("/")[0]! : null
  if (!slug) return null
  const available = [...publisherSections(publisher), ...accountSections].some(
    (section) => section.slug === slug,
  )
  return settingsHref(available ? slug : "profile")
}
