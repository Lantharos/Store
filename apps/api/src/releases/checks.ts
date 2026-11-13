import { env } from "cloudflare:workers"
import {
  type ArtifactKind,
  CHECK_TITLES,
  type CheckResult,
  type ChecksDispatch,
  type ChecksReport,
  type Platform,
  paths,
} from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { GitHubError, github } from "../github/api.ts"
import { type WorkflowClaims, workflowPath } from "../github/oidc.ts"
import { isInvitedKey, signedFileUrl } from "../invited/links.ts"
import { fail } from "../lib/http.ts"
import { recordHistory } from "../ops/events.ts"
import { previousRelease, saveChecks } from "../publishing/complete.ts"
import { type AppRow, type ArtifactRow, fileUrl, type ReleaseRow } from "../signing/records.ts"
import { notifyPublisher } from "./notify.ts"
import { routeRelease } from "./review.ts"

export const CHECKS_EVENT = "schelf-checks"
export const CHECKS_WORKFLOW = ".github/workflows/checks.yml"
export const MIRROR_WORKFLOW = ".github/workflows/mirror.yml"
const MAIN = "refs/heads/main"
const HOUR_MS = 3_600_000
const LONGEST_CHECKS_MS = 2 * HOUR_MS
const CHECKS_GIVE_UP_MS = 24 * HOUR_MS
const CHECKS_MINUTES = 3 * 60

export function requireStoreWorkflow(claims: WorkflowClaims, workflow: string) {
  if (
    claims.repository_id !== env.STORE_REPOSITORY_ID ||
    workflowPath(claims) !== workflow ||
    claims.ref !== MAIN
  )
    fail(403, `Only this store's own ${workflow} on main may call this`)
}

export async function dispatchChecks(
  release: ReleaseRow,
  app: AppRow,
  artifacts: ArtifactRow[],
  previous: ReleaseRow | null,
) {
  if (!env.GITHUB_TOKEN) {
    console.warn(`No GITHUB_TOKEN, so ${app.id} ${release.version} goes to review without the deeper checks`)
    return false
  }
  const payload: ChecksDispatch = {
    release: release.id,
    app: app.id,
    version: release.version,
    repository: app.distribution === "open" ? app.repository : null,
    scrutiny: {
      source: app.distribution === "open" ? "open" : "closed",
      strict: release.origin === "manual",
    },
    commit: release.origin === "oidc" ? release.commit : null,
    previous_commit: previous?.origin === "oidc" ? previous.commit : null,
    permissions: release.permissions,
    files: await Promise.all(
      artifacts.map(async (artifact) => ({
        name: artifact.name,
        platform: artifact.platform as Platform,
        kind: artifact.kind as ArtifactKind,
        url: isInvitedKey(artifact.key)
          ? await signedFileUrl(artifact.key, CHECKS_MINUTES)
          : fileUrl(artifact.key),
        sha256: artifact.sha256,
      })),
    ),
    callback: `${env.PUBLIC_URL}/api/v1/checks/${release.id}`,
  }
  await github(`/repositories/${env.STORE_REPOSITORY_ID}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ event_type: CHECKS_EVENT, client_payload: payload }),
  })
  return true
}

export async function acceptChecks(releaseId: string, report: ChecksReport) {
  const release = await db.query.release.findFirst({ where: eq(schema.release.id, releaseId) })
  if (!release) fail(404, "That release doesn't exist")
  if (release.status !== "checking") fail(409, "This release isn't waiting for checks")
  await saveChecks(release, report.checks)
  if (Object.keys(report.facts).length)
    await env.BUCKET.put(paths.check(release.appId, release.version, "facts"), JSON.stringify(report.facts), {
      httpMetadata: { contentType: "application/json" },
    })
  if (report.checks.some((check) => check.status === "failed")) {
    await db.update(schema.release).set({ status: "failed" }).where(eq(schema.release.id, release.id))
    recordHistory("release", release.id, failedChecks(report.checks))
    await notifyPublisher(release.id, "failed")
    return "failed" as const
  }
  await routeRelease(release.id)
  return (await db.query.release.findFirst({ where: eq(schema.release.id, release.id) }))!.status
}

/** The checks workflow can die without reporting, so anything past its time limit runs again, and fails after a day. */
export async function restartStalledChecks(now = new Date()) {
  const waiting = await db.select().from(schema.release).where(eq(schema.release.status, "checking"))
  const ageOf = (release: ReleaseRow) => now.getTime() - release.createdAt.getTime()
  for (const release of waiting.filter((release) => ageOf(release) > LONGEST_CHECKS_MS)) {
    if (ageOf(release) > CHECKS_GIVE_UP_MS) {
      await acceptChecks(release.id, {
        checks: [
          {
            name: "malware",
            status: "failed",
            summary: "The checks never finished, so publish a new release",
          },
        ],
        facts: {},
      })
      continue
    }
    const app = (await db.query.app.findFirst({ where: eq(schema.app.id, release.appId) }))!
    const artifacts = await db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, release.id))
    const previous = await previousRelease(release)
    await dispatchChecks(release, app, artifacts, previous ?? null).catch((error: unknown) => {
      if (!(error instanceof GitHubError)) throw error
      console.error(`Couldn't restart the checks for ${app.id} ${release.version}: ${error.message}`)
    })
  }
}

export function failedChecks(checks: Pick<CheckResult, "name" | "status">[]) {
  const failed = checks.filter((check) => check.status === "failed").map((check) => CHECK_TITLES[check.name])
  return `Failed its checks: ${failed.join(", ")}`
}
