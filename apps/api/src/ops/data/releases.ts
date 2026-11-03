import { DEFAULT_LOCALE, type ReleaseStatus, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, desc, eq, inArray, isNull, like, or, type SQL } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"

function releaseQuery() {
  return db
    .select({
      release: schema.release,
      name: schema.listing.name,
      kind: schema.app.kind,
      appStatus: schema.app.status,
      publisherId: schema.app.publisherId,
      publisher: schema.publisher.name,
      publisherSlug: schema.publisher.slug,
      repository: schema.app.repository,
      slug: schema.app.slug,
      visibility: schema.app.visibility,
      distribution: schema.app.distribution,
    })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
}

type Row = Awaited<ReturnType<ReturnType<typeof releaseQuery>["execute"]>>[number]

function view({ release, name, ...app }: Row) {
  return { ...release, ...app, name: name ?? release.appId }
}

export type ReleaseView = ReturnType<typeof view>

function matching(query: string): SQL | undefined {
  if (!query) return undefined
  const pattern = `%${query}%`
  return or(
    eq(schema.release.id, query),
    eq(schema.release.version, query),
    like(schema.release.appId, pattern),
    like(schema.listing.name, pattern),
    like(schema.release.commit, `${query}%`),
  )
}

export const releases = {
  async byId(id: string) {
    const [row] = await releaseQuery().where(eq(schema.release.id, id))
    return row ? view(row) : null
  },
  async search(query: string, limit: number) {
    const rows = await releaseQuery()
      .where(matching(query))
      .orderBy(desc(schema.release.createdAt))
      .limit(limit)
    return rows.map(view)
  },
  async browse(query: string, status: ReleaseStatus | undefined, cursor: string | null, limit: number) {
    const offset = Number(cursor ?? 0)
    const rows = await releaseQuery()
      .where(and(matching(query), status ? eq(schema.release.status, status) : undefined))
      .orderBy(desc(schema.release.createdAt))
      .limit(limit)
      .offset(offset)
    return { records: rows.map(view), cursor: rows.length === limit ? String(offset + limit) : null }
  },
  async ofApp(appId: string, limit: number) {
    const rows = await releaseQuery()
      .where(eq(schema.release.appId, appId))
      .orderBy(desc(schema.release.createdAt))
      .limit(limit)
    return rows.map(view)
  },
  async latestShipped(appId: string) {
    const [row] = await releaseQuery()
      .where(and(eq(schema.release.appId, appId), inArray(schema.release.status, [...SHIPPED_STATUSES])))
      .orderBy(desc(schema.release.approvedAt))
      .limit(1)
    return row ? view(row) : null
  },
  checks(id: string) {
    return db.select().from(schema.check).where(eq(schema.check.releaseId, id))
  },
  artifacts(id: string) {
    return db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, id))
  },
  reviews(id: string) {
    return db
      .select()
      .from(schema.review)
      .where(eq(schema.review.releaseId, id))
      .orderBy(desc(schema.review.createdAt))
  },
  activeBlock(id: string) {
    return db.query.block.findFirst({
      where: and(eq(schema.block.releaseId, id), isNull(schema.block.liftedAt)),
      orderBy: desc(schema.block.createdAt),
    })
  },
}
