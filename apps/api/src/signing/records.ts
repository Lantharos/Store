import { env } from "cloudflare:workers"
import { DEFAULT_LOCALE, type EndedChannels, endedChannelsOf, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm"
import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import { db, schema } from "../db/client.ts"
import { DAY_MS, dayOf } from "../lib/time.ts"

export type AppRow = typeof schema.app.$inferSelect
export type ReleaseRow = typeof schema.release.$inferSelect
export type ArtifactRow = typeof schema.artifact.$inferSelect
export type IndexedArtifact = ArtifactRow & {
  deltas: { from: string; key: string; size: number; sha256: string }[]
}

export interface AppRecord {
  app: AppRow
  publisher: { name: string; slug: string; verified: boolean }
  listing: (typeof schema.listing.$inferSelect)[]
  meta: typeof schema.listingMeta.$inferSelect | null
  screenshots: (typeof schema.screenshot.$inferSelect)[]
  releases: { release: ReleaseRow; artifacts: IndexedArtifact[] }[]
  endedChannels: EndedChannels
  installs30d: number
}

export const INDEXED_RELEASES = 5

const D1_PARAMETER_ROOM = 90

export function within(column: SQLiteColumn, values: string[]) {
  return values.length <= D1_PARAMETER_ROOM ? inArray(column, values) : undefined
}

export function fileUrl(key: string) {
  return `${env.DOWNLOAD_URL}/${key}`
}

export function mediaUrl(key: string | null | undefined) {
  return key ? fileUrl(key) : null
}

export function englishListing(record: Pick<AppRecord, "listing" | "app">) {
  return (
    record.listing.find((entry) => entry.locale === DEFAULT_LOCALE) ?? {
      name: record.app.id.split(".").at(-1)!,
      summary: "",
      description: "",
      keywords: [],
    }
  )
}

function groupBy<T, K>(rows: T[], keyOf: (row: T) => K) {
  const groups = new Map<K, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }
  return groups
}

function listedPerChannel(releases: ReleaseRow[]) {
  const seen = new Map<string, number>()
  const minimums = new Set<string>()
  return releases.filter((release) => {
    const count = seen.get(release.channel) ?? 0
    seen.set(release.channel, count + 1)
    const minimum = `${release.channel} ${release.luftMinimum}`
    const newestForItsLuft = release.luftMinimum !== null && !minimums.has(minimum)
    minimums.add(minimum)
    return count < INDEXED_RELEASES || newestForItsLuft
  })
}

export async function blockedReleaseIds(appIds: string[]) {
  const rows = await db
    .select({ appId: schema.block.appId, releaseId: schema.block.releaseId })
    .from(schema.block)
    .where(
      and(
        within(schema.block.appId, appIds),
        isNull(schema.block.liftedAt),
        eq(schema.block.action, "block"),
      ),
    )
  return {
    apps: new Set(rows.filter((row) => row.releaseId === null).map((row) => row.appId)),
    releases: new Set(rows.flatMap((row) => (row.releaseId ? [row.releaseId] : []))),
  }
}

export async function installsSince(appIds: string[], days: number) {
  if (appIds.length === 0) return new Map<string, number>()
  const since = dayOf(new Date(Date.now() - days * DAY_MS))
  const rows = await db
    .select({ appId: schema.countDaily.appId, installs: sql<number>`sum(${schema.countDaily.installs})` })
    .from(schema.countDaily)
    .where(and(within(schema.countDaily.appId, appIds), gte(schema.countDaily.day, since)))
    .groupBy(schema.countDaily.appId)
  return new Map(rows.map((row) => [row.appId, row.installs]))
}

export async function loadApps(apps: AppRow[]): Promise<AppRecord[]> {
  if (apps.length === 0) return []
  const ids = apps.map((app) => app.id)
  const publisherIds = [...new Set(apps.map((app) => app.publisherId))]
  const [publishers, listings, metas, screenshots, releases, ended, blocked, installs] = await Promise.all([
    db.select().from(schema.publisher).where(within(schema.publisher.id, publisherIds)),
    db.select().from(schema.listing).where(within(schema.listing.appId, ids)),
    db.select().from(schema.listingMeta).where(within(schema.listingMeta.appId, ids)),
    db
      .select()
      .from(schema.screenshot)
      .where(within(schema.screenshot.appId, ids))
      .orderBy(schema.screenshot.position),
    db
      .select()
      .from(schema.release)
      .where(and(within(schema.release.appId, ids), inArray(schema.release.status, [...SHIPPED_STATUSES])))
      .orderBy(desc(schema.release.approvedAt)),
    db
      .select()
      .from(schema.channel)
      .where(and(within(schema.channel.appId, ids), isNotNull(schema.channel.endedInto))),
    blockedReleaseIds(ids),
    installsSince(ids, 30),
  ])
  const shipped = groupBy(
    releases.filter((release) => !blocked.releases.has(release.id)),
    (release) => release.appId,
  )
  const indexed = [...shipped.values()].flatMap(listedPerChannel)
  const artifacts = groupBy(
    indexed.length
      ? await db
          .select()
          .from(schema.artifact)
          .where(
            within(
              schema.artifact.releaseId,
              indexed.map((release) => release.id),
            ),
          )
      : [],
    (artifact) => artifact.releaseId,
  )
  const artifactIds = [...artifacts.values()].flat().map((artifact) => artifact.id)
  const deltas = groupBy(
    artifactIds.length
      ? await db
          .select({
            artifactId: schema.delta.artifactId,
            from: schema.release.version,
            key: schema.delta.key,
            size: schema.delta.size,
            sha256: schema.delta.sha256,
          })
          .from(schema.delta)
          .innerJoin(schema.release, eq(schema.delta.fromReleaseId, schema.release.id))
          .where(within(schema.delta.artifactId, artifactIds))
      : [],
    (delta) => delta.artifactId,
  )
  const publisherById = new Map(publishers.map((publisher) => [publisher.id, publisher]))
  const listingsByApp = groupBy(listings, (row) => row.appId)
  const metaByApp = new Map(metas.map((meta) => [meta.appId, meta]))
  const screenshotsByApp = groupBy(screenshots, (row) => row.appId)
  const endedByApp = groupBy(ended, (row) => row.appId)
  return apps.map((app) => {
    const publisher = publisherById.get(app.publisherId)!
    return {
      app,
      publisher: { name: publisher.name, slug: publisher.slug, verified: publisher.verifiedAt !== null },
      listing: listingsByApp.get(app.id) ?? [],
      meta: metaByApp.get(app.id) ?? null,
      screenshots: screenshotsByApp.get(app.id) ?? [],
      releases: blocked.apps.has(app.id)
        ? []
        : listedPerChannel(shipped.get(app.id) ?? []).map((release) => ({
            release,
            artifacts: (artifacts.get(release.id) ?? []).map((artifact) => ({
              ...artifact,
              deltas: deltas.get(artifact.id) ?? [],
            })),
          })),
      endedChannels: endedChannelsOf(endedByApp.get(app.id) ?? []),
      installs30d: installs.get(app.id) ?? 0,
    }
  })
}
