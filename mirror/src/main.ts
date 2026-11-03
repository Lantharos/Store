import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import {
  API_BASE,
  downloadUrl,
  type MirrorCatalog,
  type MirrorEntry,
  type MirrorOrigin,
  type MirrorRequest,
  type MirrorResponse,
  paths,
  STORE_ORIGIN,
} from "@schelf/protocol"
import { ApiFailure, githubOidcToken, request } from "@schelf/publisher"
import { fedoraCandidates, fedoraEntry, fedoraUrls, flathubIndex, hostOf, onFlathub } from "./fedora.ts"
import { flathubCandidates, flathubEntry } from "./flathub.ts"
import { hostIcons } from "./icons.ts"
import { type Candidate, exclusion } from "./rules.ts"

const api = process.env.SCHELF_API ?? STORE_ORIGIN
const fedoraRelease = process.env.FEDORA_RELEASE!
const work = join(process.env.RUNNER_TEMP ?? "/tmp", "schelf-mirror")
const now = new Date()

async function download(url: string, path: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  await Bun.write(path, response)
}

async function previous(origin: MirrorOrigin): Promise<MirrorEntry[]> {
  const response = await fetch(downloadUrl(paths.mirror(origin)))
  return response.ok ? ((await response.json()) as MirrorCatalog).apps : []
}

function report(origin: string, candidates: { candidate: Candidate }[], kept: number) {
  const reasons = new Map<string, number>()
  for (const { candidate } of candidates) {
    const reason = exclusion(candidate, now)
    if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  console.log(`${origin}: ${kept} of ${candidates.length} kept`)
  for (const [reason, count] of [...reasons].sort((left, right) => right[1] - left[1]))
    console.log(`  ${count} left out: ${reason}`)
}

const sameApps = (left: MirrorEntry[], right: MirrorEntry[]) =>
  JSON.stringify([...left].sort((a, b) => a.id.localeCompare(b.id))) ===
  JSON.stringify([...right].sort((a, b) => a.id.localeCompare(b.id)))

await mkdir(work, { recursive: true })
const iconArchive = join(work, "icons.tar.gz")
const [flathub, fedora, previousFlathub, previousFedora] = await Promise.all([
  flathubCandidates(),
  fedoraCandidates(fedoraRelease),
  previous("flathub"),
  previous("fedora"),
  download(fedoraUrls(fedoraRelease).icons, iconArchive),
])

const keptFlathub = flathub.filter(({ candidate }) => exclusion(candidate, now) === null)
report("Flathub", flathub, keptFlathub.length)
const flathubApps = flathubIndex(
  keptFlathub.map(({ candidate, component }) => ({
    id: candidate.id,
    name: candidate.name,
    homepage: hostOf(component?.urls.homepage),
  })),
)
const qualified = fedora.filter(({ candidate }) => exclusion(candidate, now) === null)
const keptFedora = qualified.filter(({ component }) => !onFlathub(component, flathubApps))
report(`Fedora ${fedoraRelease}`, fedora, keptFedora.length)
console.log(`  ${qualified.length - keptFedora.length} left out: on Flathub`)

const iconDirectory = join(work, "icons")
await mkdir(iconDirectory, { recursive: true })
await Bun.$`tar -xzf ${iconArchive} -C ${iconDirectory}`
const icons = await hostIcons({
  api,
  directory: iconDirectory,
  icons: keptFedora
    .filter(({ candidate }) => candidate.icon && !candidate.icon.startsWith("http"))
    .map(({ candidate }) => ({ id: candidate.id, file: candidate.icon! })),
  known: new Set(previousFedora.map((entry) => entry.icon).filter((icon) => icon !== null)),
})

const body: MirrorRequest = {
  flathub: keptFlathub.map(({ candidate }) => flathubEntry(candidate, now)),
  fedora: keptFedora.map(({ candidate, component }) =>
    fedoraEntry(candidate, component, icons.get(candidate.id) ?? candidate.icon, now),
  ),
}
if (sameApps(body.flathub, previousFlathub) && sameApps(body.fedora, previousFedora)) {
  console.log("Nothing changed since the last run")
} else {
  const result = await request<MirrorResponse>(`${api}${API_BASE}/mirror`, {
    method: "POST",
    token: await githubOidcToken(),
    body: JSON.stringify(body),
  }).catch((error: unknown) => {
    throw error instanceof ApiFailure ? new Error(`The store refused the mirror: ${error.detail}`) : error
  })
  console.log(`Published ${result.flathub} Flathub and ${result.fedora} Fedora apps`)
}
