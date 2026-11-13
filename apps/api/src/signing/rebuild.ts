import { env } from "cloudflare:workers"
import {
  type Catalog,
  INVITED_PREFIX,
  type MirrorCatalog,
  type MirrorOrigin,
  paths,
  type Revocations,
  signSabineFeed,
  type Unstamped,
} from "@schelf/protocol"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { appIndex, catalogEntry, mirrorCatalogEntry, sabineFeeds, sabineParts } from "./documents.ts"
import { signingKey } from "./keys.ts"
import { loadApps } from "./records.ts"
import { writeFeed, writeSigned } from "./write.ts"

const INDEXED_APP_STATUSES = new Set(["published", "delisted", "pulled", "deleted"])

export async function rebuildApp(id: string) {
  const app = await db.query.app.findFirst({ where: eq(schema.app.id, id) })
  if (!app || !INDEXED_APP_STATUSES.has(app.status)) {
    await env.BUCKET.delete([paths.app(id), paths.signature(paths.app(id))])
    return
  }
  const [record] = await loadApps([app])
  if (app.status === "deleted") {
    await writeSigned(paths.app(id), appIndex({ ...record!, releases: [] }))
    await removeSabineFeeds(id)
    return
  }
  await writeSigned(paths.app(id), appIndex(record!))
  const key = await signingKey()
  const written = new Set<string>()
  for (const part of [null, ...sabineParts(record!)])
    for (const [channel, feed] of sabineFeeds(record!, part)) {
      const invited = record!.inviteOnly.has(channel)
      const path = part
        ? (invited ? paths.invitedSabinePart : paths.sabinePart)(id, part, channel)
        : (invited ? paths.invitedSabine : paths.sabine)(id, channel)
      await writeFeed(path, await signSabineFeed(key, feed))
      written.add(path)
    }
  for (const channel of record!.inviteOnly) {
    const path = paths.invitedApp(id, channel)
    await writeSigned(path, appIndex(record!, channel))
    written.add(path).add(paths.signature(path))
  }
  await removeStale(id, written)
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
  const records = await loadApps(listed)
  const catalog: Unstamped<Catalog> = {
    version: 1,
    generated: new Date().toISOString(),
    apps: records.map(catalogEntry).sort((left, right) => right.installs_30d - left.installs_30d),
  }
  await writeSigned(paths.catalog, catalog)
}

export async function rebuildMirror(origin: MirrorOrigin) {
  const rows = await db
    .select()
    .from(schema.mirrorApp)
    .where(and(eq(schema.mirrorApp.origin, origin), isNull(schema.mirrorApp.hiddenReason)))
    .orderBy(desc(schema.mirrorApp.rank), schema.mirrorApp.id)
  await writeSigned(paths.mirror(origin), {
    version: 1,
    generated: new Date().toISOString(),
    origin,
    apps: rows.map(mirrorCatalogEntry),
  } satisfies Unstamped<MirrorCatalog>)
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
  await writeSigned(paths.revocations, {
    issued: new Date().toISOString(),
    blocked: [...merged.values()],
  } satisfies Unstamped<Revocations>)
}
