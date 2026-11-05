import { env } from "cloudflare:workers"
import { compareVersions, NIGHTLY, NIGHTLY_KEEP, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, desc, eq, inArray, isNotNull, notInArray } from "drizzle-orm"
import { db, insertRows, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { recordHistory } from "../ops/events.ts"
import { routeRelease } from "../releases/review.ts"
import { resignApp } from "../signing/queue.ts"
import type { ReleaseRow } from "../signing/records.ts"
import { refuseEnded } from "./ended.ts"

const WAITING = ["uploading", "checking", "in-review"] as const

export function ensureChannel(appId: string, name: string) {
  return db
    .insert(schema.channel)
    .values({ appId, name, keep: name === NIGHTLY ? NIGHTLY_KEEP : null })
    .onConflictDoNothing()
}

async function removeReleases(appId: string, ids: string[]) {
  const artifacts = await db
    .select({ key: schema.artifact.key })
    .from(schema.artifact)
    .where(inArray(schema.artifact.releaseId, ids))
  const keys = [...new Set(artifacts.map((artifact) => artifact.key))]
  const shared = keys.length
    ? await db
        .select({ key: schema.artifact.key })
        .from(schema.artifact)
        .where(and(inArray(schema.artifact.key, keys), notInArray(schema.artifact.releaseId, ids)))
    : []
  const kept = new Set(shared.map((artifact) => artifact.key))
  const removable = keys.filter((key) => !kept.has(key))
  if (removable.length) await env.BUCKET.delete(removable)
  await db.delete(schema.release).where(inArray(schema.release.id, ids))
  recordHistory(
    "app",
    appId,
    `Removed ${ids.length} old release${ids.length === 1 ? "" : "s"} past the channel's limit`,
  )
}

export async function pruneChannel(appId: string, name: string, keep: number) {
  const releases = await db
    .select({ id: schema.release.id, status: schema.release.status })
    .from(schema.release)
    .where(
      and(
        eq(schema.release.appId, appId),
        eq(schema.release.channel, name),
        notInArray(schema.release.status, [...WAITING, "pulled"]),
      ),
    )
    .orderBy(desc(schema.release.createdAt))
  const past = releases.slice(keep).map((release) => release.id)
  if (!past.length) return
  await removeReleases(appId, past)
  await resignApp(appId)
}

export async function pruneChannels() {
  const limited = await db.select().from(schema.channel).where(isNotNull(schema.channel.keep))
  for (const channel of limited) await pruneChannel(channel.appId, channel.name, channel.keep!)
}

const shipped = (status: string) => (SHIPPED_STATUSES as readonly string[]).includes(status)

export async function promote(release: ReleaseRow, channel: string, by: string, notes = release.notes) {
  if (!shipped(release.status)) fail(409, "Only a release that's out can be promoted")
  if (release.channel === channel) fail(409, `${release.version} is on ${channel} already`)
  await refuseEnded(release.appId, channel)
  const [current] = await db
    .select({ version: schema.release.version })
    .from(schema.release)
    .where(
      and(
        eq(schema.release.appId, release.appId),
        eq(schema.release.channel, channel),
        inArray(schema.release.status, [...SHIPPED_STATUSES]),
      ),
    )
    .orderBy(desc(schema.release.approvedAt))
    .limit(1)
  if (current && compareVersions(release.version, current.version) <= 0)
    fail(409, `${channel} already has ${current.version}, which isn't older than ${release.version}`)
  const taken = await db.$count(
    schema.release,
    and(
      eq(schema.release.appId, release.appId),
      eq(schema.release.channel, channel),
      eq(schema.release.version, release.version),
    ),
  )
  if (taken) fail(409, `${release.version} was already sent to ${channel}`)

  const id = randomId()
  const [artifacts, checks] = await Promise.all([
    db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, release.id)),
    db.select().from(schema.check).where(eq(schema.check.releaseId, release.id)),
  ])
  await ensureChannel(release.appId, channel)
  await db.batch([
    db.insert(schema.release).values({
      ...release,
      id,
      channel,
      notes,
      promotedFrom: release.id,
      status: "checking",
      rolloutPercent: 0,
      rolloutPaused: false,
      rolloutSteppedAt: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date(),
    }),
    ...insertRows(
      schema.artifact,
      artifacts.map((artifact) => ({ ...artifact, id: randomId(), releaseId: id })),
    ),
    ...insertRows(
      schema.check,
      checks.map((check) => ({ ...check, releaseId: id })),
    ),
  ])
  recordHistory("release", id, `Promoted from ${release.channel}`, by)
  await routeRelease(id)
  return id
}
