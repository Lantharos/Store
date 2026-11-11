import { SHIPPED_STATUSES } from "@schelf/protocol"
import { and, eq, inArray, isNull, or } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { recordHistory, tellOps } from "../ops/events.ts"
import { resignApp, resignPublisher } from "../signing/queue.ts"
import type { ReleaseRow } from "../signing/records.ts"
import { notifyPublisher } from "./notify.ts"
import { filesOf, REVIEWABLE } from "./shell-files.ts"

async function extensionRelease(releaseId: string) {
  const [row] = await db
    .select({ release: schema.release, kind: schema.app.kind, verifiedAt: schema.publisher.verifiedAt })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .where(eq(schema.release.id, releaseId))
  if (!row) fail(404, "That release doesn't exist")
  if (row.kind !== "extension") fail(422, "Only extensions run inside Luft")
  return { release: row.release, verified: row.verifiedAt !== null }
}

async function approvable(releaseId: string) {
  const { release, verified } = await extensionRelease(releaseId)
  if (!verified) fail(403, "Only extensions from a verified publisher run inside Luft")
  if (!REVIEWABLE.includes(release.status))
    fail(409, `This release is ${release.status}, so it can't run inside Luft`)
  return release
}

export async function requestShell(releaseId: string, by: string) {
  const release = await approvable(releaseId)
  if (release.shellReview !== null) fail(409, "Running inside Luft was already asked for")
  await db.update(schema.release).set({ shellReview: "waiting" }).where(eq(schema.release.id, release.id))
  tellOps({ type: "shell", release: release.id })
  recordHistory("release", release.id, "Asked to run inside Luft", by)
}

async function approve(release: ReleaseRow, by: string, at: Date) {
  const artifacts = await db
    .select({ sha256: schema.artifact.sha256 })
    .from(schema.artifact)
    .where(eq(schema.artifact.releaseId, release.id))
  await db
    .update(schema.release)
    .set({
      shellReview: "approved",
      shellFiles: filesOf(artifacts),
      shellReason: null,
      shellDecidedBy: by,
      shellDecidedAt: at,
    })
    .where(eq(schema.release.id, release.id))
}

export async function allowInShell(releaseId: string, by: string) {
  const release = await approvable(releaseId)
  if (release.shellReview === "approved") fail(409, "This release already runs inside Luft")
  await approve(release, by, new Date())
  recordHistory("release", release.id, "Approved to run inside Luft", by)
  await resignApp(release.appId)
  notifyPublisher(release.id, "inside-luft")
  return `${release.appId} ${release.version} runs inside Luft`
}

export async function refuseShell(releaseId: string, by: string, reason: string) {
  const { release } = await extensionRelease(releaseId)
  if (release.shellReview === "refused") fail(409, "This release was already refused")
  await db
    .update(schema.release)
    .set({
      shellReview: "refused",
      shellFiles: null,
      shellReason: reason,
      shellDecidedBy: by,
      shellDecidedAt: new Date(),
    })
    .where(eq(schema.release.id, release.id))
  recordHistory("release", release.id, `Refused to run inside Luft: ${reason}`, by)
  if (release.shellReview === "approved") await resignApp(release.appId)
  notifyPublisher(release.id, "not-inside-luft", reason)
  return `${release.appId} ${release.version} won't run inside Luft`
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
