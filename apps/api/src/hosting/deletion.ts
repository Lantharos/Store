import { env } from "cloudflare:workers"
import { type DeletedProject, paths } from "@schelf/protocol"
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { recordHistory } from "../ops/events.ts"
import { appById } from "../publishing/start.ts"
import { resign, resignApp } from "../signing/queue.ts"
import type { AppRow } from "../signing/records.ts"

export const GRACE_DAYS = 30
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000
const R2_DELETE_BATCH = 1000

export const purgeAt = (deletedAt: Date) => new Date(deletedAt.getTime() + GRACE_MS)

const ownFiles = (id: string) => [`apps/${id}/`, `media/${id}/`, `sabine/${id}/`]

async function removeFiles(prefixes: string[], extra: string[] = []) {
  const keys = [...extra]
  for (const prefix of prefixes) {
    let cursor: string | undefined
    do {
      const page = await env.BUCKET.list({ prefix, cursor })
      keys.push(...page.objects.map((object) => object.key))
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
  }
  for (let start = 0; start < keys.length; start += R2_DELETE_BATCH)
    await env.BUCKET.delete(keys.slice(start, start + R2_DELETE_BATCH))
}

function everApproved(appId: string) {
  return db.$count(schema.release, and(eq(schema.release.appId, appId), isNotNull(schema.release.approvedAt)))
}

export async function deleteProject(app: AppRow, by: string): Promise<DeletedProject> {
  if (app.status === "deleted") fail(409, "It's deleted already")
  if (!(await everApproved(app.id))) {
    await removeFiles(ownFiles(app.id), [paths.app(app.id), paths.signature(paths.app(app.id))])
    await db.batch([
      db.delete(schema.countDaily).where(eq(schema.countDaily.appId, app.id)),
      db.delete(schema.app).where(eq(schema.app.id, app.id)),
    ])
    recordHistory("app", app.id, "Deleted before anything was released", by)
    return { id: app.id, restorable_until: null }
  }
  const deletedAt = new Date()
  await db
    .update(schema.app)
    .set({ status: "deleted", statusBeforeDelete: app.status, deletedAt })
    .where(eq(schema.app.id, app.id))
  await resignApp(app.id)
  recordHistory("app", app.id, `Deleted; it can be restored until ${purgeAt(deletedAt).toDateString()}`, by)
  return { id: app.id, restorable_until: purgeAt(deletedAt).toISOString() }
}

export async function restoreProject(app: AppRow, by: string) {
  if (app.status !== "deleted" || !app.deletedAt || app.purgedAt) fail(409, "It can't be restored anymore")
  if (purgeAt(app.deletedAt) < new Date()) fail(409, "It can't be restored anymore")
  await db
    .update(schema.app)
    .set({ status: app.statusBeforeDelete!, statusBeforeDelete: null, deletedAt: null })
    .where(eq(schema.app.id, app.id))
  await resignApp(app.id)
  recordHistory("app", app.id, "Restored", by)
}

export async function purgeDeleted(now = new Date()) {
  const due = await db
    .select({ id: schema.app.id })
    .from(schema.app)
    .where(
      and(
        eq(schema.app.status, "deleted"),
        isNull(schema.app.purgedAt),
        lt(schema.app.deletedAt, new Date(now.getTime() - GRACE_MS)),
      ),
    )
  if (!due.length) return
  const ids = due.map((app) => app.id)
  for (const id of ids) await removeFiles(ownFiles(id))
  await db.batch([
    db.delete(schema.release).where(inArray(schema.release.appId, ids)),
    db.delete(schema.screenshot).where(inArray(schema.screenshot.appId, ids)),
    db.delete(schema.listingMeta).where(inArray(schema.listingMeta.appId, ids)),
    db.delete(schema.trustedPublisher).where(inArray(schema.trustedPublisher.appId, ids)),
    db.delete(schema.token).where(inArray(schema.token.appId, ids)),
    db.delete(schema.channel).where(inArray(schema.channel.appId, ids)),
    db.delete(schema.updaterSwitch).where(inArray(schema.updaterSwitch.appId, ids)),
    db.delete(schema.countDaily).where(inArray(schema.countDaily.appId, ids)),
    db.update(schema.app).set({ purgedAt: now }).where(inArray(schema.app.id, ids)),
  ])
  await resign(...ids.map((id) => ({ type: "app" as const, id })))
  for (const id of ids) recordHistory("app", id, "Its files were removed, 30 days after it was deleted")
}

export async function reclaimPurged(publisherId: string, id: string) {
  const existing = await appById(id)
  if (!existing) return
  if (existing.status === "deleted" && existing.publisherId === publisherId) {
    if (!existing.purgedAt) fail(409, `${id} was deleted recently; restore it from the dashboard instead`)
    await db.delete(schema.app).where(eq(schema.app.id, id))
    return
  }
  fail(409, `${id} is taken`)
}
