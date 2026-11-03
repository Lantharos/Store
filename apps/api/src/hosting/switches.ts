import { type Format, SHIPPED_STATUSES, UPDATER_NAMES, type Updater } from "@schelf/protocol"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { recordHistory } from "../ops/events.ts"
import { resignApp } from "../signing/queue.ts"
import type { AppRow, ReleaseRow } from "../signing/records.ts"

export type SwitchRow = typeof schema.updaterSwitch.$inferSelect

const FORMAT_OF: Record<Updater, Format> = { sabine: "sabine", electron: "files", tauri: "files" }

export function latestSwitch(appId: string) {
  return db.query.updaterSwitch.findFirst({
    where: eq(schema.updaterSwitch.appId, appId),
    orderBy: desc(schema.updaterSwitch.createdAt),
  })
}

async function shippedWith(appId: string, updater: Updater) {
  return db.$count(
    schema.release,
    and(
      eq(schema.release.appId, appId),
      eq(schema.release.updater, updater),
      inArray(schema.release.status, [...SHIPPED_STATUSES, "withdrawn"]),
    ),
  )
}

export async function startSwitch(app: AppRow, to: Updater, by: string) {
  if (app.kind === "extension") fail(409, "Extensions always update through Schelf")
  if (app.updater === to) fail(409, `It updates with ${UPDATER_NAMES[to]} already`)
  const open = await latestSwitch(app.id)
  if (open && !open.completedAt) fail(409, "A move to a new framework is already under way")
  const format = FORMAT_OF[to]
  if (!app.updater || !(await shippedWith(app.id, app.updater))) {
    await db.update(schema.app).set({ updater: to, format }).where(eq(schema.app.id, app.id))
    recordHistory("app", app.id, `Updates with ${UPDATER_NAMES[to]}`, by)
    return null
  }
  const row: SwitchRow = {
    id: randomId(),
    appId: app.id,
    fromUpdater: app.updater,
    toUpdater: to,
    fromFormat: app.format,
    toFormat: format,
    startedBy: by,
    firstReleaseId: null,
    bridgeReleaseId: null,
    completedAt: null,
    createdAt: new Date(),
  }
  await db.batch([
    db.insert(schema.updaterSwitch).values(row),
    db.update(schema.app).set({ updater: to, format }).where(eq(schema.app.id, app.id)),
  ])
  recordHistory(
    "app",
    app.id,
    `Started moving from ${UPDATER_NAMES[row.fromUpdater]} to ${UPDATER_NAMES[to]}`,
    by,
  )
  return row
}

export async function cancelSwitch(app: AppRow, by: string) {
  const open = await latestSwitch(app.id)
  if (!open || open.completedAt) fail(409, "No move is under way")
  if (open.firstReleaseId || open.bridgeReleaseId)
    fail(409, "Releases for the move are out already; finish it with the bridge")
  await db.batch([
    db.delete(schema.updaterSwitch).where(eq(schema.updaterSwitch.id, open.id)),
    db
      .update(schema.app)
      .set({ updater: open.fromUpdater, format: open.fromFormat })
      .where(eq(schema.app.id, app.id)),
  ])
  recordHistory("app", app.id, `Stopped moving to ${UPDATER_NAMES[open.toUpdater]}`, by)
}

export async function releaseLine(app: AppRow, format: Format, bridge: boolean) {
  if (bridge) {
    const move = await latestSwitch(app.id)
    if (!move)
      fail(422, "A bridge release hands over to a new framework; start the move in the dashboard first")
    if (format !== move.fromFormat)
      fail(422, `The bridge is built the old way, as ${move.fromFormat}, not ${format}`)
    return { updater: move.fromUpdater, bridge: true }
  }
  if (format !== app.format)
    fail(
      422,
      `${app.id} ships ${app.format} now, not ${format}. To change how it updates, use "Change how this app updates" in the dashboard`,
    )
  return { updater: format === "sabine" ? ("sabine" as const) : app.updater, bridge: false }
}

export async function noteShipped(release: ReleaseRow) {
  const move = await latestSwitch(release.appId)
  if (!move || move.completedAt) return
  const firstReleaseId =
    move.firstReleaseId ?? (!release.bridge && release.updater === move.toUpdater ? release.id : null)
  const bridgeReleaseId = release.bridge ? release.id : move.bridgeReleaseId
  const done = firstReleaseId && bridgeReleaseId
  await db
    .update(schema.updaterSwitch)
    .set({ firstReleaseId, bridgeReleaseId, completedAt: done ? new Date() : null })
    .where(eq(schema.updaterSwitch.id, move.id))
  if (done) {
    recordHistory(
      "app",
      release.appId,
      `Moved from ${UPDATER_NAMES[move.fromUpdater]} to ${UPDATER_NAMES[move.toUpdater]}`,
    )
    await resignApp(release.appId)
  }
}
