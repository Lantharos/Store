import { nextRolloutStep, type RolloutRequest, rolloutDue } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { recordHistory, rolloutsAreFrozen } from "../ops/events.ts"
import { resign, resignApp } from "../signing/queue.ts"
import type { ReleaseRow } from "../signing/records.ts"
import { gradualChannels } from "./gradual.ts"
import { notifyPublisher } from "./notify.ts"

const CONTROLLABLE = new Set(["rolling-out", "live"])

function percentUpdate(percent: number, now: Date) {
  return {
    rolloutPercent: percent,
    rolloutSteppedAt: now,
    status: percent === 100 ? ("live" as const) : ("rolling-out" as const),
  }
}

export async function controlRollout(release: ReleaseRow, request: RolloutRequest) {
  if (!CONTROLLABLE.has(release.status)) fail(409, `A ${release.status} release has no rollout to control`)
  const now = new Date()
  const changes =
    request.action === "pause"
      ? { rolloutPaused: true }
      : request.action === "resume"
        ? { rolloutPaused: false, rolloutSteppedAt: now }
        : request.action === "all"
          ? { ...percentUpdate(100, now), rolloutPaused: false }
          : request.action === "set"
            ? percentUpdate(request.percent, now)
            : { status: "withdrawn" as const }
  await db.update(schema.release).set(changes).where(eq(schema.release.id, release.id))
  await resignApp(release.appId)
  return describe(release, request)
}

function describe(release: ReleaseRow, request: RolloutRequest) {
  const name = `${release.appId} ${release.version}`
  switch (request.action) {
    case "pause":
      return `Paused the rollout of ${name}`
    case "resume":
      return `Resumed the rollout of ${name}`
    case "all":
      return `${name} goes to everyone`
    case "set":
      return `${name} goes to ${request.percent}% of devices`
    case "rollback":
      return `Rolled back ${name}; devices are offered the previous version`
  }
}

export async function stepRollouts(now = new Date()) {
  if (await rolloutsAreFrozen()) return []
  const rolling = await db
    .select()
    .from(schema.release)
    .where(and(eq(schema.release.status, "rolling-out"), eq(schema.release.rolloutPaused, false)))
  const due = rolling.filter((release) =>
    rolloutDue(release.rolloutPercent, release.rolloutSteppedAt ?? release.approvedAt ?? now, now),
  )
  if (!due.length) return due
  const apps = [...new Set(due.map((release) => release.appId))]
  const gradual = await gradualChannels(apps)
  const steps = due.map((release) => ({
    release,
    percent: gradual(release.appId, release.channel) ? nextRolloutStep(release.rolloutPercent) : 100,
  }))
  await db.batch(
    steps.map(({ release, percent }) =>
      db.update(schema.release).set(percentUpdate(percent, now)).where(eq(schema.release.id, release.id)),
    ) as never,
  )
  for (const { release, percent } of steps) {
    if (percent === 100) notifyPublisher(release.id, "live")
    recordHistory(
      "release",
      release.id,
      percent === 100 ? "Rolled out to everyone" : `Rolled out to ${percent}%`,
    )
  }
  await resign(...apps.map((id) => ({ type: "app" as const, id })), { type: "catalog" })
  return due
}
