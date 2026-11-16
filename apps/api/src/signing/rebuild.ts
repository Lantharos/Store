import { env } from "cloudflare:workers"
import {
  type Catalog,
  INVITED_PREFIX,
  type MirrorCatalog,
  type MirrorOrigin,
  paths,
  type Revocations,
  signSabineFeed,
  toolsOf,
  type Unstamped,
} from "@schelf/protocol"
import { and, desc, eq, isNull } from "drizzle-orm"
import { among, db, schema } from "../db/client.ts"
import { inParallel } from "../lib/parallel.ts"
import { removeToolIndexes, writeToolIndexes } from "../tools/index-files.ts"
import { loadCatalogApps } from "./catalog-records.ts"
import { appIndex, catalogEntry, mirrorCatalogEntry, sabineFeeds, sabineParts } from "./documents.ts"
import { signingKey } from "./keys.ts"
import { type AppRecord, loadApps } from "./records.ts"
import { writeFeed, writeSigned } from "./write.ts"

const INDEXED_APP_STATUSES = new Set(["published", "delisted", "pulled", "deleted"])
const APPS_AT_ONCE = 8

/** Signs the index, feeds and tool files of each app again, or removes the index of an app that's gone. */
export async function rebuildApps(ids: string[]) {
  const apps = await db.select().from(schema.app).where(among(schema.app.id, ids))
  const indexed = apps.filter((app) => INDEXED_APP_STATUSES.has(app.status))
  const kept = new Set(indexed.map((app) => app.id))
  const gone = ids
    .filter((id) => !kept.has(id))
    .flatMap((id) => [paths.app(id), paths.signature(paths.app(id))])
  await Promise.all([
    gone.length && env.BUCKET.delete(gone),
    inParallel(await loadApps(indexed), APPS_AT_ONCE, rebuildRecord),
  ])
}

async function rebuildRecord(record: AppRecord) {
  const { app } = record
  if (app.status === "deleted") {
    await Promise.all([
      writeSigned({ key: paths.app(app.id), document: appIndex({ ...record, releases: [] }) }),
      removeSabineFeeds(app.id),
      removeToolIndexes(app, record.publisher.slug, toolsOf(app)),
    ])
    return
  }
  const invited = [...record.inviteOnly].map((channel) => ({
    key: paths.invitedApp(app.id, channel),
    document: appIndex(record, channel),
  }))
  const [feeds] = await Promise.all([
    writeFeeds(record),
    writeSigned({ key: paths.app(app.id), document: appIndex(record) }, ...invited),
    writeToolIndexes(record),
  ])
  await removeStale(app.id, new Set([...feeds, ...invited.flatMap(({ key }) => [key, paths.signature(key)])]))
}

async function writeFeeds(record: AppRecord) {
  const key = await signingKey()
  const { id } = record.app
  const feeds = [null, ...sabineParts(record)].flatMap((part) =>
    [...sabineFeeds(record, part)].map(([channel, feed]) => {
      const invited = record.inviteOnly.has(channel)
      const path = part
        ? (invited ? paths.invitedSabinePart : paths.sabinePart)(id, part, channel)
        : (invited ? paths.invitedSabine : paths.sabine)(id, channel)
      return { path, feed }
    }),
  )
  await Promise.all(feeds.map(async ({ path, feed }) => writeFeed(path, await signSabineFeed(key, feed))))
  return feeds.map(({ path }) => path)
}

async function removeStale(id: string, kept: Set<string>) {
  const listed = await Promise.all(
    [`${INVITED_PREFIX}index/v1/apps/${id}/`, `${INVITED_PREFIX}sabine/${id}/`, `sabine/${id}/parts/`].map(
      (prefix) => env.BUCKET.list({ prefix }),
    ),
  )
  const stale = listed
    .flatMap((list) => list.objects.map((object) => object.key))
    .filter((key) => !kept.has(key))
  if (stale.length) await env.BUCKET.delete(stale)
}

async function removeSabineFeeds(id: string) {
  const feeds = await env.BUCKET.list({ prefix: `sabine/${id}/` })
  if (feeds.objects.length) await env.BUCKET.delete(feeds.objects.map((object) => object.key))
  await removeStale(id, new Set())
}

export async function rebuildCatalog() {
  const listed = await db
    .select()
    .from(schema.app)
    .where(and(eq(schema.app.status, "published"), eq(schema.app.visibility, "listed")))
  const records = await loadCatalogApps(listed)
  const catalog: Unstamped<Catalog> = {
    version: 1,
    generated: new Date().toISOString(),
    apps: records.map(catalogEntry).sort((left, right) => right.installs_30d - left.installs_30d),
  }
  await writeSigned({ key: paths.catalog, document: catalog })
}

export async function rebuildMirror(origin: MirrorOrigin) {
  const rows = await db
    .select()
    .from(schema.mirrorApp)
    .where(and(eq(schema.mirrorApp.origin, origin), isNull(schema.mirrorApp.hiddenReason)))
    .orderBy(desc(schema.mirrorApp.rank), schema.mirrorApp.id)
  await writeSigned({
    key: paths.mirror(origin),
    document: {
      version: 1,
      generated: new Date().toISOString(),
      origin,
      apps: rows.map(mirrorCatalogEntry),
    } satisfies Unstamped<MirrorCatalog>,
  })
}

export async function rebuildRevocations() {
  const blocks = await db
    .select({
      app: schema.block.appId,
      version: schema.release.version,
      action: schema.block.action,
      reason: schema.block.reason,
      note: schema.block.publicNote,
    })
    .from(schema.block)
    .leftJoin(schema.release, eq(schema.release.id, schema.block.releaseId))
    .where(isNull(schema.block.liftedAt))
  const merged = new Map<string, Revocations["blocked"][number]>()
  for (const entry of blocks) {
    const id = `${entry.app}:${entry.action}`
    const existing = merged.get(id)
    const versions = entry.version ? [entry.version] : ("*" as const)
    if (!existing)
      merged.set(id, {
        app: entry.app,
        versions,
        action: entry.action,
        reason: entry.reason,
        ...(entry.note ? { note: entry.note } : {}),
      })
    else if (existing.versions !== "*")
      existing.versions = versions === "*" ? "*" : [...existing.versions, ...versions]
  }
  await writeSigned({
    key: paths.revocations,
    document: {
      issued: new Date().toISOString(),
      blocked: [...merged.values()],
    } satisfies Unstamped<Revocations>,
  })
}
