import BadgeCheck from "@lucide/svelte/icons/badge-check"
import Braces from "@lucide/svelte/icons/braces"
import CircleUserRound from "@lucide/svelte/icons/circle-user-round"
import ScrollText from "@lucide/svelte/icons/scroll-text"
import Store from "@lucide/svelte/icons/store"
import SunMoon from "@lucide/svelte/icons/sun-moon"
import UsersRound from "@lucide/svelte/icons/users-round"
import type { DashboardPublisher } from "@schelf/protocol"
import type { Component } from "svelte"

export interface Section {
  slug: string
  label: string
  icon: Component
}

export const SETTINGS = "/dashboard/settings"

export const settingsHref = (slug: string) => `${SETTINGS}/${slug}`

export function publisherSections(publisher: DashboardPublisher): Section[] {
  return [
    { slug: "profile", label: "Profile", icon: Store },
    ...(publisher.kind === "organisation" ? [{ slug: "members", label: "Members", icon: UsersRound }] : []),
    { slug: "namespaces", label: "Namespaces", icon: Braces },
    { slug: "verification", label: "Verification", icon: BadgeCheck },
  ]
}

export const accountSections: Section[] = [
  { slug: "account", label: "Account", icon: CircleUserRound },
  { slug: "appearance", label: "Appearance", icon: SunMoon },
  { slug: "agreement", label: "Developer agreement", icon: ScrollText },
]

export function sectionAfterSwitch(path: string, publisher: DashboardPublisher) {
  const slug = path.startsWith(`${SETTINGS}/`) ? path.slice(SETTINGS.length + 1).split("/")[0]! : null
  if (!slug) return null
  const available = [...publisherSections(publisher), ...accountSections].some(
    (section) => section.slug === slug,
  )
  return settingsHref(available ? slug : "profile")
}
