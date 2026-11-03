import { DEFAULT_LOCALE } from "@schelf/protocol"
import { and, asc, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { DAY_MS, dayOf } from "../../lib/time.ts"

export async function storeTotals() {
  const since = dayOf(new Date(Date.now() - 30 * DAY_MS))
  const [listed, publishers, verified, installs] = await Promise.all([
    db.$count(schema.app, eq(schema.app.status, "published")),
    db.$count(schema.publisher),
    db.$count(schema.publisher, isNotNull(schema.publisher.verifiedAt)),
    db
      .select({ total: sql<number>`coalesce(sum(${schema.countDaily.installs}), 0)` })
      .from(schema.countDaily)
      .where(gte(schema.countDaily.day, since)),
  ])
  return { listed, publishers, verified, installs: installs[0]!.total }
}

export function rollingOut() {
  return db
    .select({
      id: schema.release.id,
      appId: schema.release.appId,
      name: schema.listing.name,
      version: schema.release.version,
      percent: schema.release.rolloutPercent,
      paused: schema.release.rolloutPaused,
      steppedAt: schema.release.rolloutSteppedAt,
    })
    .from(schema.release)
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.release.appId), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(eq(schema.release.status, "rolling-out"))
    .orderBy(asc(schema.release.rolloutSteppedAt))
}

export function activeBlocks() {
  return db
    .select({
      appId: schema.block.appId,
      releaseId: schema.block.releaseId,
      version: schema.release.version,
      reason: schema.block.reason,
      createdAt: schema.block.createdAt,
    })
    .from(schema.block)
    .leftJoin(schema.release, eq(schema.release.id, schema.block.releaseId))
    .where(isNull(schema.block.liftedAt))
    .orderBy(desc(schema.block.createdAt))
}

export function suspendedPublishers() {
  return db
    .select({ id: schema.publisher.id, name: schema.publisher.name })
    .from(schema.publisher)
    .where(eq(schema.publisher.status, "suspended"))
    .orderBy(asc(schema.publisher.name))
}
