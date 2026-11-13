import {
  type ArtifactKind,
  type CheckResult,
  type Platform,
  type ReleaseDetail,
  type ReleaseSummary,
  rolloutRequest,
  type ShellStatus,
  type TimelineStep,
} from "@schelf/protocol"
import { desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { fileLink } from "../../invited/links.ts"
import { readBody } from "../../lib/http.ts"
import { iso } from "../../lib/time.ts"
import { recordHistory } from "../../ops/events.ts"
import { appAccess, releaseAccess } from "../../publishers/access.ts"
import { controlRollout } from "../../releases/rollout.ts"
import { requestShell } from "../../releases/shell.ts"
import { runsInShell, shellRequestable } from "../../releases/shell-files.ts"
import type { AppRow, ArtifactRow, ReleaseRow } from "../../signing/records.ts"

export const releaseRoutes = new Hono<SignedInVars>()

const NEXT_STEPS: Partial<Record<ReleaseRow["status"], string>> = {
  uploading: "The upload didn't finish. Publish it again to start over.",
  checking: "The checks are running; this usually takes a few minutes.",
  failed: "Fix what the failed check says and publish a new release.",
  "in-review": "A person is reviewing the release. You'll get an email when they decide.",
  "changes-requested": "Make the changes the reviewer asked for and publish a new release.",
  rejected: "The reason is in the review step. Reply to the email if you'd like to appeal.",
  "rolling-out": "It reaches more devices every day. You can pause it or release it to everyone.",
}

function summary(release: ReleaseRow, artifacts: Pick<ArtifactRow, "platform">[]): ReleaseSummary {
  return {
    id: release.id,
    version: release.version,
    channel: release.channel,
    ref: release.ref,
    origin: release.origin,
    format: release.format,
    updater: release.updater,
    bridge: release.bridge,
    promoted_from: release.promotedFrom,
    status: release.status,
    rollout_percent: release.rolloutPercent,
    rollout_paused: release.rolloutPaused,
    platforms: [...new Set(artifacts.map((artifact) => artifact.platform as Platform))],
    created_at: release.createdAt.toISOString(),
    approved_at: iso(release.approvedAt),
    approved_by: release.approvedBy,
  }
}

releaseRoutes.get("/:id/releases", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"))
  const [releases, artifacts] = await Promise.all([
    db
      .select()
      .from(schema.release)
      .where(eq(schema.release.appId, app.id))
      .orderBy(desc(schema.release.createdAt))
      .limit(50),
    db
      .select({ releaseId: schema.artifact.releaseId, platform: schema.artifact.platform })
      .from(schema.artifact)
      .innerJoin(schema.release, eq(schema.release.id, schema.artifact.releaseId))
      .where(eq(schema.release.appId, app.id)),
  ])
  return c.json(
    releases.map((release) =>
      summary(
        release,
        artifacts.filter((artifact) => artifact.releaseId === release.id),
      ),
    ) satisfies ReleaseSummary[],
  )
})

interface Owner {
  app: Pick<AppRow, "kind">
  publisher: { verifiedAt: Date | null }
}

function shellStatus(
  release: ReleaseRow,
  artifacts: ArtifactRow[],
  { app, publisher }: Owner,
): ShellStatus | null {
  if (app.kind !== "extension") return null
  const verified = publisher.verifiedAt !== null
  return {
    review: release.shellReview,
    runs_in_shell: runsInShell(release, artifacts, verified),
    reason: release.shellReview === "refused" ? release.shellReason : null,
    verified,
    requestable: shellRequestable(release, verified),
  }
}

async function detail(release: ReleaseRow, owner: Owner): Promise<ReleaseDetail> {
  const [artifacts, checks, reviews] = await Promise.all([
    db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, release.id)),
    db
      .select()
      .from(schema.check)
      .where(eq(schema.check.releaseId, release.id))
      .orderBy(schema.check.createdAt),
    db
      .select()
      .from(schema.review)
      .where(eq(schema.review.releaseId, release.id))
      .orderBy(schema.review.createdAt),
  ])
  const checkResults: CheckResult[] = checks.map((check) => ({
    name: check.name,
    status: check.status,
    summary: check.summary,
  }))
  const timeline: TimelineStep[] = [
    {
      kind: "uploaded",
      at: release.createdAt.toISOString(),
      origin: release.origin,
      run_url: release.runUrl,
    },
    ...checks.map((check, index) => ({
      kind: "check" as const,
      at: check.createdAt.toISOString(),
      check: checkResults[index]!,
    })),
    ...reviews.map((review) => ({
      kind: "review" as const,
      at: (review.decidedAt ?? review.createdAt).toISOString(),
      decision: review.decision,
      reason: review.reason,
    })),
    ...(release.rolloutSteppedAt
      ? [
          {
            kind: "rollout" as const,
            at: release.rolloutSteppedAt.toISOString(),
            percent: release.rolloutPercent,
            paused: release.rolloutPaused,
          },
        ]
      : []),
  ]
  return {
    ...summary(release, artifacts),
    notes: release.notes,
    commit: release.commit,
    run_url: release.runUrl,
    permissions: release.permissions,
    permissions_widened: release.permissionsWidened,
    luft: release.luftMinimum,
    shell: shellStatus(release, artifacts, owner),
    artifacts: await Promise.all(
      artifacts.map(async (artifact) => ({
        part: artifact.part,
        platform: artifact.platform as Platform,
        kind: artifact.kind as ArtifactKind,
        name: artifact.name,
        size: artifact.size,
        sha256: artifact.sha256,
        url: await fileLink(artifact.key),
        attestation: artifact.attestationUrl,
      })),
    ),
    checks: checkResults,
    timeline,
    next: NEXT_STEPS[release.status] ?? null,
  }
}

async function current(id: string) {
  return (await db.query.release.findFirst({ where: eq(schema.release.id, id) }))!
}

releaseRoutes.get("/:id/releases/:release", async (c) => {
  const { release, ...owner } = await releaseAccess(c.var.viewer, c.req.param("id"), c.req.param("release"))
  return c.json(await detail(release, owner))
})

releaseRoutes.post("/:id/releases/:release/rollout", async (c) => {
  const { release, ...owner } = await releaseAccess(
    c.var.viewer,
    c.req.param("id"),
    c.req.param("release"),
    "releases",
  )
  const done = await controlRollout(release, await readBody(c, rolloutRequest))
  recordHistory("release", release.id, done, c.var.viewer.name)
  return c.json(await detail(await current(release.id), owner))
})

releaseRoutes.post("/:id/releases/:release/inside-luft", async (c) => {
  const { release, ...owner } = await releaseAccess(
    c.var.viewer,
    c.req.param("id"),
    c.req.param("release"),
    "releases",
  )
  await requestShell(release.id, c.var.viewer.name)
  return c.json(await detail(await current(release.id), owner))
})
