import { AUTOMATIC_REVIEWER, ROLLOUT_STEPS, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { reviewRoute } from "../hosting/scrutiny.ts"
import { noteShipped } from "../hosting/switches.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { recordHistory, tellOps } from "../ops/events.ts"
import { resignApp } from "../signing/queue.ts"
import { reindexApp } from "../storefront/indexing.ts"
import { channelIsGradual } from "./gradual.ts"
import { notifyPublisher } from "./notify.ts"

export type Decision = "approved" | "changes-requested" | "rejected"
const FIRST_STEP = ROLLOUT_STEPS[0]

async function releaseOrFail(id: string) {
  const release = await db.query.release.findFirst({ where: eq(schema.release.id, id) })
  if (!release) fail(404, "That release doesn't exist")
  return release
}

export async function routeRelease(releaseId: string) {
  const release = await releaseOrFail(releaseId)
  const [app, checks] = await Promise.all([
    db.query.app.findFirst({ where: eq(schema.app.id, release.appId) }),
    db.select().from(schema.check).where(eq(schema.check.releaseId, release.id)),
  ])
  const route = reviewRoute({
    origin: release.origin,
    visibility: app!.visibility,
    channel: release.channel,
    checks,
  })
  if (route.route === "review") return sendToReview(release.id, route.because)
  await db.update(schema.release).set({ status: "in-review" }).where(eq(schema.release.id, release.id))
  recordHistory("release", release.id, "Passed every check, so it went out without a person's review")
  await approve(release.id, AUTOMATIC_REVIEWER)
}

async function sendToReview(releaseId: string, because: string) {
  const release = await releaseOrFail(releaseId)
  const shipped = await db.$count(
    schema.release,
    and(
      eq(schema.release.appId, release.appId),
      inArray(schema.release.status, [...SHIPPED_STATUSES, "withdrawn"]),
    ),
  )
  const kind = shipped ? "update" : "submission"
  await db.batch([
    db.update(schema.release).set({ status: "in-review" }).where(eq(schema.release.id, release.id)),
    db
      .update(schema.app)
      .set({ status: "in-review" })
      .where(and(eq(schema.app.id, release.appId), eq(schema.app.status, "draft"))),
    db.insert(schema.review).values({ id: randomId(), releaseId: release.id, kind }),
  ])
  tellOps({ type: "release", release: release.id, kind })
  recordHistory(
    "release",
    release.id,
    `${kind === "submission" ? "Sent for review as a new app" : "Sent for review"}: ${because}`,
  )
}

async function recordDecision(releaseId: string, decision: Decision, by: string, reason: string | null) {
  await db
    .update(schema.review)
    .set({ decision, decidedBy: by, decidedAt: new Date(), reason })
    .where(and(eq(schema.review.releaseId, releaseId), isNull(schema.review.decision)))
}

export async function approve(releaseId: string, by: string, { security = false } = {}) {
  const release = await releaseOrFail(releaseId)
  if (release.status !== "in-review") fail(409, `This release is ${release.status}, not waiting for review`)
  const now = new Date()
  const percent = security || !(await channelIsGradual(release.appId, release.channel)) ? 100 : FIRST_STEP
  await db.batch([
    db
      .update(schema.release)
      .set({
        status: percent === 100 ? "live" : "rolling-out",
        rolloutPercent: percent,
        rolloutPaused: false,
        rolloutSteppedAt: now,
        approvedBy: by,
        approvedAt: now,
      })
      .where(eq(schema.release.id, release.id)),
    db
      .update(schema.app)
      .set({ status: "published" })
      .where(and(eq(schema.app.id, release.appId), inArray(schema.app.status, ["draft", "in-review"]))),
  ])
  if (by !== AUTOMATIC_REVIEWER) await recordDecision(release.id, "approved", by, null)
  await Promise.all([resignApp(release.appId), reindexApp(release.appId), noteShipped(release)])
  if (by !== AUTOMATIC_REVIEWER) notifyPublisher(release.id, "approved")
  return `${release.appId} ${release.version} is approved and rolling out to ${percent}%`
}

async function decline(
  releaseId: string,
  decision: Exclude<Decision, "approved">,
  by: string,
  reason: string,
) {
  const release = await releaseOrFail(releaseId)
  if (release.status !== "in-review") fail(409, `This release is ${release.status}, not waiting for review`)
  await db.update(schema.release).set({ status: decision }).where(eq(schema.release.id, release.id))
  const shipped = await db.$count(
    schema.release,
    and(eq(schema.release.appId, release.appId), inArray(schema.release.status, [...SHIPPED_STATUSES])),
  )
  if (!shipped)
    await db
      .update(schema.app)
      .set({ status: "draft" })
      .where(and(eq(schema.app.id, release.appId), eq(schema.app.status, "in-review")))
  await recordDecision(release.id, decision, by, reason)
  notifyPublisher(release.id, decision, reason)
  return release
}

export async function requestChanges(releaseId: string, by: string, message: string) {
  const release = await decline(releaseId, "changes-requested", by, message)
  return `Asked for changes to ${release.appId} ${release.version}`
}

export async function reject(releaseId: string, by: string, reason: string) {
  const release = await decline(releaseId, "rejected", by, reason)
  return `Rejected ${release.appId} ${release.version}`
}
