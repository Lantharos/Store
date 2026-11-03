import { type Component, parseCollection } from "@schelf/appstream"
import type { MirrorEntry } from "@schelf/protocol"
import { gunzipText } from "./fetch.ts"
import { type Candidate, latest, rank } from "./rules.ts"

const BASE = "https://dl.fedoraproject.org/pub/alt/screenshots"
const LIBRARY_PACKAGE = /^lib|-(libs?|devel|common|data)$/
const ICON_SIZES = [128, 64]

export const fedoraUrls = (release: string) => ({
  appstream: `${BASE}/f${release}/fedora-${release}.xml.gz`,
  icons: `${BASE}/f${release}/fedora-${release}-icons.tar.gz`,
})

export const normalizedId = (id: string) => id.replace(/\.desktop$/, "").toLowerCase()

export function cachedIcon(component: Component) {
  for (const size of ICON_SIZES) {
    const icon = component.icons.find((candidate) => candidate.kind === "cached" && candidate.width === size)
    if (icon) return `${size}x${size}/${icon.value}`
  }
  return component.icons.find((candidate) => candidate.kind === "remote")?.value ?? null
}

export async function fedoraCandidates(release: string) {
  const { components } = parseCollection(await gunzipText(fedoraUrls(release).appstream))
  return components
    .filter((component) => component.packageName)
    .map((component) => {
      const candidate: Candidate = {
        id: component.id.replace(/\.desktop$/, ""),
        type: component.type,
        name: component.name.en ?? "",
        summary: component.summary.en ?? "",
        icon: cachedIcon(component),
        categories: component.categories,
        developer: component.developer ?? "",
        verified: false,
        installs30d: null,
        screenshots: component.screenshots.length,
        lastRelease: latest(component.releases.map((entry) => entry.date)),
        lastBuild: null,
        endOfLife: false,
        renamedTo: null,
        deprecatedRuntime: false,
        desktopEntry: component.type === "desktop" || component.launchable !== undefined,
        libraryOnly: LIBRARY_PACKAGE.test(component.packageName!),
      }
      return { candidate, component }
    })
}

export function hostOf(url: string | undefined) {
  if (!url) return undefined
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

export interface FlathubIndex {
  ids: Set<string>
  byName: Map<string, { id: string; homepage?: string }[]>
}

export function flathubIndex(apps: { id: string; name: string; homepage?: string }[]): FlathubIndex {
  const byName = new Map<string, { id: string; homepage?: string }[]>()
  for (const app of apps) {
    const name = app.name.toLowerCase()
    byName.set(name, [...(byName.get(name) ?? []), { id: app.id.toLowerCase(), homepage: app.homepage }])
  }
  return { ids: new Set(apps.map((app) => app.id.toLowerCase())), byName }
}

export function onFlathub(component: Component, flathub: FlathubIndex) {
  const id = normalizedId(component.id)
  if (flathub.ids.has(id)) return true
  const homepage = hostOf(component.urls.homepage)
  return (flathub.byName.get(component.name.en?.toLowerCase() ?? "") ?? []).some(
    (app) => app.id.endsWith(`.${id}`) || (homepage !== undefined && app.homepage === homepage),
  )
}

export function fedoraEntry(
  candidate: Candidate,
  component: Component,
  icon: string | null,
  now: Date,
): MirrorEntry {
  return {
    origin: "fedora",
    package: component.packageName!,
    id: candidate.id,
    kind: "app",
    name: candidate.name,
    summary: candidate.summary,
    icon,
    categories: candidate.categories,
    developer: { name: candidate.developer, verified: false },
    updated: (candidate.lastRelease ?? now).toISOString(),
    installs_30d: 0,
    rank: rank(candidate, now),
  }
}
