import {
  type CheckResult,
  type Platform,
  type ReleaseDetail,
  type ReleaseSummary,
  rolloutRequest,
  type TimelineStep,
} from "@schelf/protocol"
import { desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { readBody } from "../../lib/http.ts"
import { iso } from "../../lib/time.ts"
import { appAccess, releaseAccess } from "../../publishers/access.ts"
import { controlRollout } from "../../releases/rollout.ts"
import type { ArtifactRow, ReleaseRow } from "../../signing/records.ts"

export const releaseRoutes = new Hono<SignedInVars>()

const NEXT_STEPS: Partial<Record<ReleaseRow["status"], string>> = {
  uploading: "The upload didn't finish. Run the workflow again to publish this tag.",
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
    tag: release.tag,
    origin: release.origin,
    status: release.status,
    rollout_percent: release.rolloutPercent,
    rollout_paused: release.rolloutPaused,
    platforms: [...new Set(artifacts.map((artifact) => artifact.platform as Platform))],
    created_at: release.createdAt.toISOString(),
    approved_at: iso(release.approvedAt),
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

async function detail(release: ReleaseRow): Promise<ReleaseDetail> {
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
    artifacts: artifacts.map((artifact) => ({
      platform: artifact.platform as Platform,
      name: artifact.name,
      size: artifact.size,
      sha256: artifact.sha256,
      attested: artifact.attestationUrl !== null,
    })),
    checks: checkResults,
    timeline,
    next: NEXT_STEPS[release.status] ?? null,
  }
}

releaseRoutes.get("/:id/releases/:release", async (c) => {
  const { release } = await releaseAccess(c.var.viewer, c.req.param("id"), c.req.param("release"))
  return c.json(await detail(release))
})

releaseRoutes.post("/:id/releases/:release/rollout", async (c) => {
  const { release } = await releaseAccess(c.var.viewer, c.req.param("id"), c.req.param("release"), "releases")
  await controlRollout(release, await readBody(c, rolloutRequest))
  const updated = (await db.query.release.findFirst({ where: eq(schema.release.id, release.id) }))!
  return c.json(await detail(updated))
})
