import { openAsBlob } from "node:fs"
import { join } from "node:path"
import type { CheckResult, ChecksDispatch, ChecksReport, ChecksResponse, DeltaReport } from "@schelf/protocol"
import { githubOidcToken, mapLimit, request } from "@schelf/publisher"
import { makeDeltas } from "./deltas.ts"
import { download } from "./download.ts"
import { type Inspection, inspectArtifact } from "./inspect/index.ts"
import { diffResult, inspectionResult, licenceResult, malwareResult } from "./results.ts"
import { scanForMalware } from "./scan.ts"
import { judgeLicence } from "./source/licence.ts"
import { Repository } from "./source/repository.ts"
import { unpack } from "./unpack.ts"

const payload = JSON.parse(process.env.PAYLOAD!) as ChecksDispatch
const work = join(process.env.RUNNER_TEMP ?? "/tmp", "schelf-checks")
const facts: Record<string, unknown> = {}

async function attempt(name: CheckResult["name"], work: () => Promise<CheckResult>): Promise<CheckResult> {
  try {
    return await work()
  } catch (error) {
    console.error(`${name}:`, error)
    return { name, status: "warning", summary: `Couldn't finish: ${(error as Error).message.slice(0, 300)}` }
  }
}

console.log(`Checking ${payload.app} ${payload.version} (${payload.files.length} files)`)
const downloads = await mapLimit(payload.files, 3, async (file) => ({
  ...file,
  path: await download(file.url, join(work, "files", file.platform), file.name, file.sha256),
  unpacked: join(work, "unpacked", file.platform, file.name),
}))

const unpacked = await mapLimit(downloads, 2, async (file) => {
  try {
    await unpack(file.path, file.unpacked)
    return file
  } catch (error) {
    console.error(`Couldn't unpack ${file.name}:`, error)
    facts[`unpack:${file.name}`] = (error as Error).message
    return undefined
  }
})
const opened = unpacked.filter((file) => file !== undefined)

const repository =
  payload.repository && payload.tag
    ? await Repository.clone(payload.repository, join(work, "source"))
    : undefined
const inspections: Record<string, Inspection> = {}

const checks = await Promise.all([
  attempt("malware", async () => {
    const hits = await scanForMalware([join(work, "files"), join(work, "unpacked")], work)
    facts.malware = hits
    return malwareResult(hits)
  }),
  attempt("inspection", async () => {
    for (const file of opened)
      inspections[file.name] = await inspectArtifact(file.unpacked, payload.permissions)
    facts.inspection = inspections
    return inspectionResult(inspections)
  }),
  attempt("diff", async () => {
    if (!repository || !payload.tag)
      return {
        name: "diff",
        status: "passed",
        summary: "The source isn't public, so review looks at the build",
      }
    if (!payload.previous_tag)
      return { name: "diff", status: "passed", summary: "First release; nothing to compare" }
    const { patch, ...diff } = await repository.diff(payload.previous_tag, payload.tag)
    facts.diff = diff
    facts.patch = patch
    facts.compare = `https://github.com/${payload.repository}/compare/${payload.previous_tag}...${payload.tag}`
    return diffResult(diff, payload.previous_tag, payload.tag)
  }),
])

checks.push(
  await attempt("licence", async () => {
    const files = repository && payload.tag ? await repository.licenceFiles(payload.tag) : []
    const declared = Object.values(inspections).find((inspection) => inspection.licence)?.licence ?? null
    const licence = judgeLicence(declared, files)
    facts.licence = licence
    return licenceResult(licence)
  }),
)

const deltas: DeltaReport[] = await makeDeltas({
  app: payload.app,
  version: payload.version,
  targets: downloads.map((file) => ({ platform: file.platform, kind: file.kind, path: file.path })),
  workDirectory: work,
  upload: async (platform, from, path) =>
    request<DeltaReport>(`${payload.callback}/deltas/${platform}?from=${encodeURIComponent(from)}`, {
      method: "PUT",
      token: await githubOidcToken(),
      body: await openAsBlob(path),
    }),
}).catch((error: unknown) => {
  console.error("Deltas:", error)
  return []
})

const report: ChecksReport = { checks, deltas, facts }
const answer = await request<ChecksResponse>(payload.callback, {
  method: "POST",
  token: await githubOidcToken(),
  body: JSON.stringify(report),
})
console.log(`Reported ${checks.length} checks and ${deltas.length} deltas; the release is ${answer.status}`)
for (const check of checks) console.log(`${check.status.padEnd(8)} ${check.name}: ${check.summary}`)
