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

const closedSource = payload.scrutiny.source === "closed"

async function attempt(name: CheckResult["name"], work: () => Promise<CheckResult>): Promise<CheckResult> {
  try {
    return await work()
  } catch (error) {
    console.error(`${name}:`, error)
    return {
      name,
      status: payload.scrutiny.strict && name === "malware" ? "failed" : "warning",
      summary: `Couldn't finish: ${(error as Error).message.slice(0, 300)}`,
    }
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
  payload.repository && payload.commit
    ? await Repository.clone(
        payload.repository,
        join(work, "source"),
        [payload.commit, payload.previous_commit].filter((commit) => commit !== null),
      )
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
    const unopened = downloads.filter((file) => !opened.includes(file))
    if (payload.scrutiny.strict && unopened.length)
      return {
        name: "inspection",
        status: "warning",
        summary: `Couldn't look inside ${unopened.map((file) => file.name).join(", ")}, so a reviewer checks it by hand`,
      }
    return inspectionResult(inspections)
  }),
  attempt("diff", async () => {
    if (!repository || !payload.commit)
      return {
        name: "diff",
        status: "passed",
        summary: closedSource
          ? "Closed source, so review looks at the build"
          : "The source isn't public, so review looks at the build",
      }
    if (!payload.previous_commit)
      return { name: "diff", status: "passed", summary: "First release; nothing to compare" }
    const { patch, ...diff } = await repository.diff(payload.previous_commit, payload.commit)
    facts.diff = diff
    facts.patch = patch
    facts.compare = `https://github.com/${payload.repository}/compare/${payload.previous_commit}...${payload.commit}`
    return diffResult(diff, payload.previous_commit.slice(0, 7), payload.commit.slice(0, 7))
  }),
])

checks.push(
  await attempt("licence", async () => {
    if (closedSource)
      return { name: "licence", status: "passed", summary: "Closed source, so there's no licence to check" }
    const files = repository && payload.commit ? await repository.licenceFiles(payload.commit) : []
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

for (const check of checks) console.log(`${check.status.padEnd(8)} ${check.name}: ${check.summary}`)
const report: ChecksReport = { checks, facts }
const answer = await request<ChecksResponse>(payload.callback, {
  method: "POST",
  token: await githubOidcToken(),
  body: JSON.stringify(report),
})
console.log(`Reported ${checks.length} checks and ${deltas.length} deltas; the release is ${answer.status}`)
