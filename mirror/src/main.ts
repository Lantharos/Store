import {
  API_BASE,
  downloadUrl,
  type MirrorCatalog,
  type MirrorEntry,
  type MirrorRequest,
  type MirrorResponse,
  paths,
  STORE_ORIGIN,
} from "@schelf/protocol"
import { ApiFailure, githubOidcToken, request } from "@schelf/runner"
import { flathubCandidates, flathubEntry } from "./flathub.ts"
import { type Candidate, exclusion } from "./rules.ts"

const api = process.env.SCHELF_API ?? STORE_ORIGIN
const now = new Date()

async function previous(): Promise<MirrorEntry[]> {
  const response = await fetch(downloadUrl(paths.mirror))
  return response.ok ? ((await response.json()) as MirrorCatalog).apps : []
}

function report(candidates: Candidate[], kept: number) {
  const reasons = new Map<string, number>()
  for (const candidate of candidates) {
    const reason = exclusion(candidate, now)
    if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  console.log(`${kept} of ${candidates.length} kept`)
  for (const [reason, count] of [...reasons].sort((left, right) => right[1] - left[1]))
    console.log(`  ${count} left out: ${reason}`)
}

const sameApps = (left: MirrorEntry[], right: MirrorEntry[]) =>
  JSON.stringify([...left].sort((a, b) => a.id.localeCompare(b.id))) ===
  JSON.stringify([...right].sort((a, b) => a.id.localeCompare(b.id)))

const [flathub, previousFlathub] = await Promise.all([flathubCandidates(), previous()])

const kept = flathub.filter((candidate) => exclusion(candidate, now) === null)
report(flathub, kept.length)

const body: MirrorRequest = { flathub: kept.map((candidate) => flathubEntry(candidate, now)) }
if (sameApps(body.flathub, previousFlathub)) {
  console.log("Nothing changed since the last run")
} else {
  const result = await request<MirrorResponse>(`${api}${API_BASE}/mirror`, {
    method: "POST",
    token: await githubOidcToken(),
    body: JSON.stringify(body),
  }).catch((error: unknown) => {
    throw error instanceof ApiFailure ? new Error(`The store refused the mirror: ${error.detail}`) : error
  })
  console.log(`Published ${result.flathub} Flathub apps`)
}
