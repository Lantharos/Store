import { env } from "cloudflare:workers"
import { DEFAULT_LOCALE, namespaceCovers, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm"
import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import { db, schema } from "../db/client.ts"
import { DAY_MS, dayOf } from "../lib/time.ts"

export type AppRow = typeof schema.app.$inferSelect
export type ReleaseRow = typeof schema.release.$inferSelect
export type ArtifactRow = typeof schema.artifact.$inferSelect

export interface AppRecord {
  app: AppRow
  developer: { name: string; slug: string; verified: boolean }
  listing: (typeof schema.listing.$inferSelect)[]
  meta: typeof schema.listingMeta.$inferSelect | null
  screenshots: (typeof schema.screenshot.$inferSelect)[]
  releases: { release: ReleaseRow; artifacts: ArtifactRow[] }[]
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
  const developerIds = [...new Set(apps.map((app) => app.developerId))]
  const [developers, namespaces, listings, metas, screenshots, releases, blocked, installs] =
    await Promise.all([
      db.select().from(schema.developer).where(within(schema.developer.id, developerIds)),
      db.select().from(schema.namespace).where(within(schema.namespace.developerId, developerIds)),
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
      blockedReleaseIds(ids),
      installsSince(ids, 30),
    ])
  const shipped = groupBy(
    releases.filter((release) => !blocked.releases.has(release.id)),
    (release) => release.appId,
  )
  const indexed = [...shipped.values()].flatMap((group) => group.slice(0, INDEXED_RELEASES))
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
  const developerById = new Map(developers.map((developer) => [developer.id, developer]))
  const listingsByApp = groupBy(listings, (row) => row.appId)
  const metaByApp = new Map(metas.map((meta) => [meta.appId, meta]))
  const screenshotsByApp = groupBy(screenshots, (row) => row.appId)
  return apps.map((app) => {
    const developer = developerById.get(app.developerId)!
    const verified = namespaces.some(
      (entry) =>
        entry.developerId === app.developerId && entry.verifiedAt && namespaceCovers(entry.prefix, app.id),
    )
    return {
      app,
      developer: { name: developer.name, slug: developer.slug, verified },
      listing: listingsByApp.get(app.id) ?? [],
      meta: metaByApp.get(app.id) ?? null,
      screenshots: screenshotsByApp.get(app.id) ?? [],
      releases: blocked.apps.has(app.id)
        ? []
        : (shipped.get(app.id) ?? [])
            .slice(0, INDEXED_RELEASES)
            .map((release) => ({ release, artifacts: artifacts.get(release.id) ?? [] })),
      installs30d: installs.get(app.id) ?? 0,
    }
  })
}
