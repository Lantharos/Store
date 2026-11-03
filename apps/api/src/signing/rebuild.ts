import { env } from "cloudflare:workers"
import { type Catalog, paths, type Revocations, signSabineFeed } from "@schelf/protocol"
import { and, eq, isNull, sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { appIndex, catalogEntry, sabineFeeds } from "./documents.ts"
import { signingKey } from "./keys.ts"
import { loadApps } from "./records.ts"
import { writeFeed, writeSigned } from "./write.ts"

const REVOCATION_SERIAL = "revocations.serial"
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
  for (const [channel, feed] of sabineFeeds(record!))
    await writeFeed(paths.sabine(id, channel), await signSabineFeed(key, feed))
}

async function removeSabineFeeds(id: string) {
  const feeds = await env.BUCKET.list({ prefix: `sabine/${id}/` })
  if (feeds.objects.length) await env.BUCKET.delete(feeds.objects.map((object) => object.key))
}

export async function rebuildCatalog() {
  const listed = await db
    .select()
    .from(schema.app)
    .where(and(eq(schema.app.status, "published"), eq(schema.app.visibility, "listed")))
  const records = await loadApps(listed)
  const catalog: Catalog = {
    version: 1,
    generated: new Date().toISOString(),
    apps: records.map(catalogEntry).sort((left, right) => right.installs_30d - left.installs_30d),
  }
  await writeSigned(paths.catalog, catalog)
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
  const serial = await nextSerial()
  await writeSigned(paths.revocations, {
    serial,
    issued: new Date().toISOString(),
    blocked: [...merged.values()],
  } satisfies Revocations)
}

async function nextSerial() {
  const [row] = await db
    .insert(schema.storeState)
    .values({ key: REVOCATION_SERIAL, value: "1" })
    .onConflictDoUpdate({
      target: schema.storeState.key,
      set: { value: sql`cast(${schema.storeState.value} as integer) + 1` },
    })
    .returning()
  return Number(row!.value)
}
