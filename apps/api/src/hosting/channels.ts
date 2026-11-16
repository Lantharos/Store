import { env } from "cloudflare:workers"
import {
  compareVersions,
  missingPlatforms,
  NIGHTLY,
  NIGHTLY_KEEP,
  paths,
  SHIPPED_STATUSES,
} from "@schelf/protocol"
import { and, desc, eq, gt, inArray, isNotNull, not, notInArray, sql } from "drizzle-orm"
import { among, db, insertRows, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { recordHistory, tellOps } from "../ops/events.ts"
import { partPlan } from "../publishing/parts.ts"
import { routeRelease } from "../releases/review.ts"
import { resign } from "../signing/queue.ts"
import type { ReleaseRow } from "../signing/records.ts"
import { refuseEnded } from "./ended.ts"

const WAITING = ["uploading", "checking", "in-review"] as const
const R2_DELETE_LIMIT = 1000

export function ensureChannel(appId: string, name: string) {
  return db
    .insert(schema.channel)
    .values({ appId, name, keep: name === NIGHTLY ? NIGHTLY_KEEP : null })
    .onConflictDoNothing()
}

async function removeReleases(releases: { id: string; appId: string }[]) {
  const ids = releases.map((release) => release.id)
  const artifacts = await db
    .select({ key: schema.artifact.key })
    .from(schema.artifact)
    .where(among(schema.artifact.releaseId, ids))
  const keys = [...new Set(artifacts.map((artifact) => artifact.key))]
  const shared = keys.length
    ? await db
        .select({ key: schema.artifact.key })
        .from(schema.artifact)
        .where(and(among(schema.artifact.key, keys), not(among(schema.artifact.releaseId, ids))))
    : []
  const kept = new Set(shared.map((artifact) => artifact.key))
  const removable = keys.filter((key) => !kept.has(key)).flatMap((key) => [key, paths.blockmap(key)])
  for (let start = 0; start < removable.length; start += R2_DELETE_LIMIT)
    await env.BUCKET.delete(removable.slice(start, start + R2_DELETE_LIMIT))
  await db.delete(schema.release).where(among(schema.release.id, ids))
  const removed = Map.groupBy(releases, (release) => release.appId)
  for (const [appId, { length }] of removed)
    recordHistory(
      "app",
      appId,
      `Removed ${length} old release${length === 1 ? "" : "s"} past the channel's limit`,
    )
  return [...removed.keys()]
}

function pastTheirLimit() {
  const ranked = db
    .select({
      id: schema.release.id,
      appId: schema.release.appId,
      keep: schema.channel.keep,
      place:
        sql<number>`row_number() over (partition by ${schema.release.appId}, ${schema.release.channel} order by ${schema.release.createdAt} desc)`.as(
          "place",
        ),
    })
    .from(schema.release)
    .innerJoin(
      schema.channel,
      and(eq(schema.channel.appId, schema.release.appId), eq(schema.channel.name, schema.release.channel)),
    )
    .where(and(isNotNull(schema.channel.keep), notInArray(schema.release.status, [...WAITING, "pulled"])))
    .as("ranked")
  return db.select({ id: ranked.id, appId: ranked.appId }).from(ranked).where(gt(ranked.place, ranked.keep))
}

/** Removes the oldest releases of every channel past the number it keeps. */
export async function pruneChannels() {
  const past = await pastTheirLimit()
  if (!past.length) return
  const apps = await removeReleases(past)
  await resign(...apps.map((id) => ({ type: "app" as const, id })), { type: "catalog" })
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
  const [artifacts, checks, app] = await Promise.all([
    db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, release.id)),
    db.select().from(schema.check).where(eq(schema.check.releaseId, release.id)),
    db.query.app.findFirst({ where: eq(schema.app.id, release.appId) }),
  ])
  const missing = missingPlatforms(partPlan(app!), artifacts)
  if (missing.length)
    fail(
      422,
      `${release.version} has nothing for ${missing.map((each) => each.platform).join(", ")}, which schelf.toml asks every release for`,
    )
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
      shellItem: null,
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
  if (release.shellReview === "waiting") tellOps({ type: "shell", release: id })
  await routeRelease(id)
  return id
}
