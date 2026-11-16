import { DEFAULT_LOCALE, SHIPPED_STATUSES, STABLE } from "@schelf/protocol"
import { and, desc, eq, inArray, isNull, max, notExists } from "drizzle-orm"
import { among, db, schema } from "../db/client.ts"
import {
  type AppRecord,
  type AppRow,
  type ArtifactRow,
  blockedReleaseIds,
  groupBy,
  installsSince,
  listedPerChannel,
  type ReleaseRow,
} from "./records.ts"

export type CatalogRelease = Pick<
  ReleaseRow,
  "id" | "version" | "channel" | "format" | "permissions" | "requires" | "rolloutPercent" | "luftMinimum"
>
export type CatalogArtifact = Pick<ArtifactRow, "part" | "platform" | "format" | "size">

export interface CatalogRecord
  extends Pick<AppRecord, "app" | "publisher" | "listing" | "meta" | "installs30d"> {
  art: string | null
  updated: Date
  stable: { release: CatalogRelease; artifacts: CatalogArtifact[] }[]
}

const shipped = inArray(schema.release.status, [...SHIPPED_STATUSES])

function newestShipped(ids: string[]) {
  const blocking = db
    .select({ id: schema.block.id })
    .from(schema.block)
    .where(
      and(
        eq(schema.block.releaseId, schema.release.id),
        isNull(schema.block.liftedAt),
        eq(schema.block.action, "block"),
      ),
    )
  return db
    .select({ appId: schema.release.appId, approvedAt: max(schema.release.approvedAt) })
    .from(schema.release)
    .where(and(among(schema.release.appId, ids), shipped, notExists(blocking)))
    .groupBy(schema.release.appId)
}

function stableReleases(ids: string[]) {
  return db
    .select({
      id: schema.release.id,
      appId: schema.release.appId,
      version: schema.release.version,
      channel: schema.release.channel,
      format: schema.release.format,
      permissions: schema.release.permissions,
      requires: schema.release.requires,
      rolloutPercent: schema.release.rolloutPercent,
      luftMinimum: schema.release.luftMinimum,
      bridge: schema.release.bridge,
    })
    .from(schema.release)
    .where(and(among(schema.release.appId, ids), eq(schema.release.channel, STABLE), shipped))
    .orderBy(desc(schema.release.approvedAt))
}

/** What the catalog shows of each app: its English listing and what's out on stable. */
export async function loadCatalogApps(apps: AppRow[]): Promise<CatalogRecord[]> {
  if (apps.length === 0) return []
  const ids = apps.map((app) => app.id)
  const extensions = apps.filter((app) => app.kind === "extension").map((app) => app.id)
  const publisherIds = [...new Set(apps.map((app) => app.publisherId))]
  const [publishers, listings, metas, shots, releases, newest, invitedStable, blocked, installs] =
    await Promise.all([
      db.select().from(schema.publisher).where(among(schema.publisher.id, publisherIds)),
      db
        .select()
        .from(schema.listing)
        .where(and(among(schema.listing.appId, ids), eq(schema.listing.locale, DEFAULT_LOCALE))),
      db.select().from(schema.listingMeta).where(among(schema.listingMeta.appId, ids)),
      extensions.length
        ? db
            .select({ appId: schema.screenshot.appId, key: schema.screenshot.key })
            .from(schema.screenshot)
            .where(among(schema.screenshot.appId, extensions))
            .orderBy(desc(schema.screenshot.position))
        : [],
      stableReleases(ids),
      newestShipped(ids),
      db
        .select({ appId: schema.channel.appId })
        .from(schema.channel)
        .where(
          and(
            among(schema.channel.appId, ids),
            eq(schema.channel.name, STABLE),
            eq(schema.channel.inviteOnly, true),
          ),
        ),
      blockedReleaseIds(ids),
      installsSince(ids, 30),
    ])
  const closed = new Set([...blocked.apps, ...invitedStable.map((row) => row.appId)])
  const kept = [
    ...groupBy(
      releases.filter((release) => !closed.has(release.appId) && !blocked.releases.has(release.id)),
      (release) => release.appId,
    ).values(),
  ].flatMap((list) => listedPerChannel(list).filter((release) => !release.bridge))
  const artifacts = groupBy(
    kept.length
      ? await db
          .select({
            releaseId: schema.artifact.releaseId,
            part: schema.artifact.part,
            platform: schema.artifact.platform,
            format: schema.artifact.format,
            size: schema.artifact.size,
          })
          .from(schema.artifact)
          .where(
            and(
              among(
                schema.artifact.releaseId,
                kept.map((release) => release.id),
              ),
              isNull(schema.artifact.part),
            ),
          )
      : [],
    (artifact) => artifact.releaseId,
  )
  const publisherById = new Map(publishers.map((publisher) => [publisher.id, publisher]))
  const listingsByApp = groupBy(listings, (row) => row.appId)
  const metaByApp = new Map(metas.map((meta) => [meta.appId, meta]))
  const artByApp = new Map(shots.map((shot) => [shot.appId, shot.key]))
  const newestByApp = new Map(newest.map((row) => [row.appId, row.approvedAt]))
  const stableByApp = groupBy(kept, (release) => release.appId)
  return apps.map((app) => {
    const publisher = publisherById.get(app.publisherId)!
    return {
      app,
      publisher: { name: publisher.name, slug: publisher.slug, verified: publisher.verifiedAt !== null },
      listing: listingsByApp.get(app.id) ?? [],
      meta: metaByApp.get(app.id) ?? null,
      art: artByApp.get(app.id) ?? null,
      updated: (!blocked.apps.has(app.id) && newestByApp.get(app.id)) || app.createdAt,
      stable: (stableByApp.get(app.id) ?? []).map((release) => ({
        release,
        artifacts: artifacts.get(release.id) ?? [],
      })),
      installs30d: installs.get(app.id) ?? 0,
    }
  })
}
