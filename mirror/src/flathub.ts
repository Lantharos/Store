import { parseCollection } from "@schelf/appstream"
import type { MirrorEntry } from "@schelf/protocol"
import { gunzipText, json } from "./fetch.ts"
import { type Candidate, latest, rank } from "./rules.ts"

const API = "https://flathub.org/api/v2"
const APPSTREAM = "https://dl.flathub.org/repo/appstream/x86_64/appstream.xml.gz"
const PAGE_SIZE = 250
const CURRENT_RUNTIME_BRANCHES = 2

interface SearchHit {
  app_id: string
  type: string
  name: string
  summary: string
  icon: string | null
  main_categories: string
  sub_categories: string[]
  developer_name: string | null
  verification_verified: boolean
  runtime: string | null
  updated_at: number
  installs_last_month: number
}

interface SearchPage {
  hits: SearchHit[]
  totalPages: number
}

async function searchAll() {
  const page = (number: number) =>
    json<SearchPage>(`${API}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "", hits_per_page: PAGE_SIZE, page: number }),
    })
  const first = await page(1)
  const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => page(index + 2)))
  return [first, ...rest].flatMap((result) => result.hits)
}

const branchOrder = (left: string, right: string) => right.localeCompare(left, "en", { numeric: true })

export function deprecatedRuntimes(usage: Record<string, number>) {
  const branches = new Map<string, string[]>()
  for (const ref of Object.keys(usage)) {
    const [name, , branch] = ref.split("/")
    if (!name || !branch) continue
    branches.set(name, [...(branches.get(name) ?? []), branch])
  }
  const deprecated = new Set<string>()
  for (const [name, list] of branches) {
    for (const branch of [...new Set(list)].sort(branchOrder).slice(CURRENT_RUNTIME_BRANCHES))
      deprecated.add(`${name}/${branch}`)
  }
  return deprecated
}

const runtimeKey = (runtime: string | null) => {
  const [name, , branch] = runtime?.split("/") ?? []
  return `${name}/${branch}`
}

export async function flathubCandidates() {
  const [hits, appstream, endOfLife, renamed, runtimes] = await Promise.all([
    searchAll(),
    gunzipText(APPSTREAM),
    json<Record<string, string>>(`${API}/eol/message`),
    json<Record<string, string[]>>(`${API}/eol/rebase`),
    json<Record<string, number>>(`${API}/runtimes`),
  ])
  const components = new Map(
    parseCollection(appstream).components.map((component) => [component.id, component]),
  )
  const deprecated = deprecatedRuntimes(runtimes)
  const renamedTo = new Map(
    Object.entries(renamed).flatMap(([newId, oldIds]) => oldIds.map((oldId) => [oldId, newId] as const)),
  )
  return hits.map((hit) => {
    const component = components.get(hit.app_id)
    const candidate: Candidate = {
      id: hit.app_id,
      type: hit.type,
      name: hit.name,
      summary: hit.summary,
      icon: hit.icon,
      categories: component?.categories.length
        ? component.categories
        : [hit.main_categories, ...hit.sub_categories],
      developer: hit.developer_name ?? component?.developer ?? "",
      verified: hit.verification_verified,
      installs30d: hit.installs_last_month,
      screenshots: component?.screenshots.length ?? 0,
      lastRelease: latest(component?.releases.map((release) => release.date) ?? []),
      lastBuild: new Date(hit.updated_at * 1000),
      endOfLife: hit.app_id in endOfLife,
      renamedTo: renamedTo.get(hit.app_id) ?? null,
      deprecatedRuntime: deprecated.has(runtimeKey(hit.runtime)),
      desktopEntry: true,
      libraryOnly: false,
    }
    return { candidate, component }
  })
}

export function flathubEntry(candidate: Candidate, now: Date): MirrorEntry {
  return {
    origin: "flathub",
    flathub: `app/${candidate.id}//stable`,
    id: candidate.id,
    kind: "app",
    name: candidate.name,
    summary: candidate.summary,
    icon: candidate.icon,
    categories: candidate.categories,
    developer: { name: candidate.developer, verified: candidate.verified },
    updated: (candidate.lastRelease ?? candidate.lastBuild ?? now).toISOString(),
    installs_30d: candidate.installs30d ?? 0,
    rank: rank(candidate, now),
  }
}
