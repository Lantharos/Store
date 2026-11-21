import { env } from "cloudflare:workers"
import {
  compareVersions,
  INVITED_PREFIX,
  missingPlatforms,
  NIGHTLY,
  NIGHTLY_KEEP,
  SHIPPED_STATUSES,
} from "@schelf/protocol"
import { and, desc, eq, gt, inArray, isNotNull, notInArray, sql } from "drizzle-orm"
import { among, db, insertRows, schema } from "../../db/client.ts"
import { fail } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { recordHistory, tellOps } from "../../ops/events.ts"
import { partPlan } from "../../publishing/parts.ts"
import { routeRelease } from "../../releases/review.ts"
import { resign } from "../../signing/queue.ts"
import type { ReleaseRow } from "../../signing/records.ts"
import { removeFiles } from "../deletion.ts"
import { refuseEnded } from "./ended.ts"

const WAITING = ["uploading", "checking", "in-review"] as const

export function ensureChannel(appId: string, name: string) {
  return db
    .insert(schema.channel)
    .values({ appId, name, keep: name === NIGHTLY ? NIGHTLY_KEEP : null })
    .onConflictDoNothing()
}

type Removed = { id: string; appId: string; version: string }

/** The files of each removed version no release uses anymore, its checks and the deltas that lead to it
 * included. A promoted release shares its version's files, so they stay while either one does. */
async function versionFiles(releases: Removed[]) {
  const apps = [...new Set(releases.map((release) => release.appId))]
  const remaining = await db
    .select({ appId: schema.release.appId, version: schema.release.version })
    .from(schema.release)
    .where(among(schema.release.appId, apps))
  const used = new Set(remaining.map((release) => `${release.appId}/${release.version}`))
  const gone = [...new Set(releases.map((release) => `${release.appId}/${release.version}`))].filter(
    (version) => !used.has(version),
  )
  const folders = gone.flatMap((version) => [`apps/${version}/`, `${INVITED_PREFIX}apps/${version}/`])
  const deltas: string[] = []
  for (const appId of apps) {
    const leadingToGone = gone
      .filter((version) => version.startsWith(`${appId}/`))
      .map((version) => `-${version.slice(appId.length + 1)}/`)
    if (!leadingToGone.length) continue
    let cursor: string | undefined
    do {
      const page = await env.BUCKET.list({ prefix: `apps/${appId}/deltas/`, cursor })
      deltas.push(
        ...page.objects
          .map((object) => object.key)
          .filter((key) => leadingToGone.some((ending) => key.includes(ending))),
      )
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
  }
  return { folders, deltas }
}

async function removeReleases(releases: Removed[]) {
  await db.delete(schema.release).where(
    among(
      schema.release.id,
      releases.map((release) => release.id),
    ),
  )
  const { folders, deltas } = await versionFiles(releases)
  await removeFiles(folders, deltas)
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
      version: schema.release.version,
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
  return db
    .select({ id: ranked.id, appId: ranked.appId, version: ranked.version })
    .from(ranked)
    .where(gt(ranked.place, ranked.keep))
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
