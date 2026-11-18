import { SHIPPED_STATUSES } from "@schelf/protocol"
import { and, eq, exists, inArray, isNull, or } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import { db, schema } from "../../db/client.ts"
import { fail } from "../../lib/http.ts"
import { recordHistory, tellOps } from "../../ops/events.ts"
import { resignApp, resignPublisher } from "../../signing/queue.ts"
import type { ReleaseRow } from "../../signing/records.ts"
import { notifyPublisher } from "../notify.ts"
import { filesOf, REVIEWABLE, shellRequestable } from "./files.ts"
import { standingApproval } from "./standing.ts"

async function extensionRelease(releaseId: string) {
  const [row] = await db
    .select({ release: schema.release, kind: schema.app.kind, verifiedAt: schema.publisher.verifiedAt })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .where(eq(schema.release.id, releaseId))
  if (!row) fail(404, "That release doesn't exist")
  if (row.kind !== "extension") fail(422, "Only extensions run inside Luft")
  return { release: row.release, verifiedAt: row.verifiedAt }
}

async function approvable(releaseId: string) {
  const { release, verifiedAt } = await extensionRelease(releaseId)
  if (!verifiedAt) fail(403, "Only extensions from a verified publisher run inside Luft")
  if (!REVIEWABLE.includes(release.status))
    fail(409, `This release is ${release.status}, so it can't run inside Luft`)
  return { release, verifiedAt }
}

async function askForShell(release: ReleaseRow, verifiedAt: Date, text: string, by?: string) {
  const standing = await standingApproval(release, verifiedAt)
  if (standing && (await inherit(release, standing))) return
  await db.update(schema.release).set({ shellReview: "waiting" }).where(eq(schema.release.id, release.id))
  tellOps({ type: "shell", release: release.id })
  recordHistory("release", release.id, text, by)
}

async function inherit(release: ReleaseRow, standing: ReleaseRow) {
  if (!(await approve(release, standing.shellDecidedBy!, new Date(), standing))) return false
  const original = standing.shellInheritedFrom ?? standing.id
  const approved = await db.query.release.findFirst({ where: eq(schema.release.id, original) })
  recordHistory(
    "release",
    release.id,
    `Runs inside Luft on ${standing.shellDecidedBy}'s approval of ${approved!.version}, as it asks for no more`,
  )
  await resignApp(release.appId)
  return true
}

export async function requestShell(releaseId: string, by: string) {
  const { release, verifiedAt } = await approvable(releaseId)
  if (release.shellReview !== null) fail(409, "Running inside Luft was already asked for")
  await askForShell(release, verifiedAt, "Asked to run inside Luft", by)
}

/** Asks for a release whose extension.toml wants it to run inside Luft, where that may be asked for. */
export async function requestWantedShell(releaseId: string) {
  const { release, verifiedAt } = await extensionRelease(releaseId)
  if (verifiedAt && shellRequestable(release, true))
    await askForShell(release, verifiedAt, "Asked to run inside Luft, as its extension.toml says")
}

const stillApproved = (standing: ReleaseRow) => {
  const approved = alias(schema.release, "standing")
  return exists(
    db
      .select({ id: approved.id })
      .from(approved)
      .where(and(eq(approved.id, standing.id), eq(approved.shellReview, "approved"))),
  )
}

async function approve(release: ReleaseRow, by: string, at: Date, standing?: ReleaseRow) {
  const artifacts = await db
    .select({ sha256: schema.artifact.sha256 })
    .from(schema.artifact)
    .where(eq(schema.artifact.releaseId, release.id))
  const approved = await db
    .update(schema.release)
    .set({
      shellReview: "approved",
      shellFiles: filesOf(artifacts),
      shellReason: null,
      shellDecidedBy: by,
      shellDecidedAt: at,
      shellInheritedFrom: standing ? (standing.shellInheritedFrom ?? standing.id) : null,
    })
    .where(and(eq(schema.release.id, release.id), standing && stillApproved(standing)))
    .returning({ id: schema.release.id })
  return approved.length > 0
}

export async function allowInShell(releaseId: string, by: string) {
  const { release } = await approvable(releaseId)
  if (release.shellReview === "approved") fail(409, "This release already runs inside Luft")
  await approve(release, by, new Date())
  recordHistory("release", release.id, "Approved to run inside Luft", by)
  await resignApp(release.appId)
  notifyPublisher(release.id, "inside-luft")
  return `${release.appId} ${release.version} runs inside Luft`
}

const REFUSED = { shellReview: "refused", shellFiles: null, shellInheritedFrom: null } as const

export async function withdrawShell(appId: string, reason: string, by?: string) {
  const withdrawn = await db
    .update(schema.release)
    .set({ ...REFUSED, shellReason: reason, shellDecidedBy: by ?? null, shellDecidedAt: new Date() })
    .where(and(eq(schema.release.appId, appId), eq(schema.release.shellReview, "approved")))
    .returning({ id: schema.release.id })
  for (const { id } of withdrawn)
    recordHistory("release", id, `Taken out of Luft with the extension's approval: ${reason}`, by)
  return withdrawn.length > 0
}

export async function refuseShell(releaseId: string, by: string, reason: string) {
  const { release } = await extensionRelease(releaseId)
  if (release.shellReview === "refused") fail(409, "This release was already refused")
  const withdrawn = release.shellReview === "approved" && (await withdrawShell(release.appId, reason, by))
  if (withdrawn) await resignApp(release.appId)
  else {
    await db
      .update(schema.release)
      .set({ ...REFUSED, shellReason: reason, shellDecidedBy: by, shellDecidedAt: new Date() })
      .where(eq(schema.release.id, release.id))
    recordHistory("release", release.id, `Refused to run inside Luft: ${reason}`, by)
  }
  notifyPublisher(release.id, "not-inside-luft", reason)
  return withdrawn
    ? `${release.appId} no longer runs inside Luft; its next release has to ask again`
    : `${release.appId} ${release.version} won't run inside Luft`
}

export async function allowPublisherInShell(publisherId: string, by: string) {
  const publisher = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, publisherId) })
  if (!publisher?.verifiedAt) fail(403, "Only extensions from a verified publisher run inside Luft")
  const rows = await db
    .select({ release: schema.release })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .where(
      and(
        eq(schema.app.publisherId, publisherId),
        eq(schema.app.kind, "extension"),
        inArray(schema.release.status, [...SHIPPED_STATUSES]),
        or(isNull(schema.release.shellReview), eq(schema.release.shellReview, "waiting")),
      ),
    )
  const at = new Date()
  for (const { release } of rows) {
    await approve(release, by, at)
    recordHistory(
      "release",
      release.id,
      "Approved to run inside Luft, with the publisher's other releases",
      by,
    )
  }
  if (rows.length) await resignPublisher(publisherId)
  return `${rows.length} release${rows.length === 1 ? "" : "s"} of ${publisher.name} run inside Luft`
}
