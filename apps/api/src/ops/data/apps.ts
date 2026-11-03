import { type AppStatus, DEFAULT_LOCALE } from "@schelf/protocol"
import { and, desc, eq, gt, isNull, like, or, type SQL, sql } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { installsSince } from "../../signing/records.ts"

const name = sql<string>`coalesce(${schema.listing.name}, ${schema.app.id})`
const now = sql`(strftime('%s', 'now') * 1000)`
const activeTokens = sql<number>`(select count(*) from ${schema.token} where ${schema.token.appId} = ${schema.app.id} and ${schema.token.revokedAt} is null and ${schema.token.expiresAt} > ${now})`
const trustedPublishers = sql<number>`(select count(*) from ${schema.trustedPublisher} where ${schema.trustedPublisher.appId} = ${schema.app.id})`

function appQuery() {
  return db
    .select({
      id: schema.app.id,
      name,
      kind: schema.app.kind,
      format: schema.app.format,
      status: schema.app.status,
      distribution: schema.app.distribution,
      repository: schema.app.repository,
      licence: schema.app.licence,
      publisherId: schema.publisher.id,
      publisher: schema.publisher.name,
      activeTokens,
      trustedPublishers,
      createdAt: schema.app.createdAt,
    })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
}

function matching(query: string): SQL | undefined {
  if (!query) return undefined
  const pattern = `%${query}%`
  return or(
    like(schema.app.id, pattern),
    like(schema.listing.name, pattern),
    like(schema.publisher.name, pattern),
  )
}

export type AppView = Awaited<ReturnType<typeof apps.byId>> & {}

export interface AppFilters {
  status?: AppStatus
  kind?: "app" | "extension"
}

export const apps = {
  async byId(id: string) {
    const [row] = await appQuery().where(eq(schema.app.id, id))
    return row ?? null
  },
  search(query: string, limit: number) {
    return appQuery().where(matching(query)).limit(limit)
  },
  async browse(query: string, filters: AppFilters, cursor: string | null, limit: number) {
    const offset = Number(cursor ?? 0)
    const records = await appQuery()
      .where(
        and(
          matching(query),
          filters.status ? eq(schema.app.status, filters.status) : undefined,
          filters.kind ? eq(schema.app.kind, filters.kind) : undefined,
        ),
      )
      .orderBy(desc(schema.app.createdAt))
      .limit(limit)
      .offset(offset)
    return { records, cursor: records.length === limit ? String(offset + limit) : null }
  },
  ofPublisher(publisherId: string) {
    return appQuery().where(eq(schema.app.publisherId, publisherId)).orderBy(desc(schema.app.createdAt))
  },
  releases(id: string, limit = 50) {
    return db
      .select()
      .from(schema.release)
      .where(eq(schema.release.appId, id))
      .orderBy(desc(schema.release.createdAt))
      .limit(limit)
  },
  async installs(id: string) {
    return (await installsSince([id], 30)).get(id) ?? 0
  },
  blocks(id: string) {
    return db
      .select({
        id: schema.block.id,
        releaseId: schema.block.releaseId,
        version: schema.release.version,
        reason: schema.block.reason,
        publicNote: schema.block.publicNote,
        createdAt: schema.block.createdAt,
      })
      .from(schema.block)
      .leftJoin(schema.release, eq(schema.release.id, schema.block.releaseId))
      .where(and(eq(schema.block.appId, id), isNull(schema.block.liftedAt)))
      .orderBy(desc(schema.block.createdAt))
  },
  activeTokens(id: string) {
    return db
      .select()
      .from(schema.token)
      .where(
        and(
          eq(schema.token.appId, id),
          isNull(schema.token.revokedAt),
          gt(schema.token.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.token.createdAt))
  },
  trustedPublishers(id: string) {
    return db
      .select()
      .from(schema.trustedPublisher)
      .where(eq(schema.trustedPublisher.appId, id))
      .orderBy(desc(schema.trustedPublisher.createdAt))
  },
  openReports(id: string) {
    return db.$count(schema.report, and(eq(schema.report.appId, id), eq(schema.report.status, "open")))
  },
}
