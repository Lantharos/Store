import { type AppStatus, DEFAULT_LOCALE } from "@schelf/protocol"
import { and, desc, eq, like, or, sql } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { installsSince } from "../../signing/records.ts"
import { latestVerification } from "../../verification/records.ts"

const name = sql<string>`coalesce(${schema.listing.name}, ${schema.app.id})`

function appQuery() {
  return db
    .select({
      id: schema.app.id,
      name,
      kind: schema.app.kind,
      format: schema.app.format,
      status: schema.app.status,
      repository: schema.app.repository,
      licence: schema.app.licence,
      publisherId: schema.publisher.id,
      publisher: schema.publisher.name,
      createdAt: schema.app.createdAt,
    })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
}

export type AppView = Awaited<ReturnType<typeof apps.byId>> & {}

export const apps = {
  async byId(id: string) {
    const [row] = await appQuery().where(eq(schema.app.id, id))
    return row ?? null
  },
  search(query: string, limit: number) {
    const pattern = `%${query}%`
    return appQuery()
      .where(or(like(schema.app.id, pattern), like(schema.listing.name, pattern)))
      .limit(limit)
  },
  async browse(status: AppStatus | undefined, cursor: string | null, limit: number) {
    const offset = Number(cursor ?? 0)
    const records = await appQuery()
      .where(status ? eq(schema.app.status, status) : undefined)
      .orderBy(desc(schema.app.createdAt))
      .limit(limit)
      .offset(offset)
    return { records, cursor: records.length === limit ? String(offset + limit) : undefined }
  },
  releases(id: string) {
    return db
      .select()
      .from(schema.release)
      .where(eq(schema.release.appId, id))
      .orderBy(desc(schema.release.createdAt))
      .limit(20)
  },
  async installs(id: string) {
    return (await installsSince([id], 30)).get(id) ?? 0
  },
}

function releaseQuery() {
  return db
    .select({
      release: schema.release,
      name,
      publisherId: schema.app.publisherId,
      publisher: schema.publisher.name,
      repository: schema.app.repository,
      format: schema.app.format,
    })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
}

export type ReleaseView = Awaited<ReturnType<typeof releases.byId>> & {}

export const releases = {
  async byId(id: string) {
    const [row] = await releaseQuery().where(eq(schema.release.id, id))
    return row
      ? {
          ...row.release,
          name: row.name,
          publisherId: row.publisherId,
          publisher: row.publisher,
          repository: row.repository,
          format: row.format,
        }
      : null
  },
  async search(query: string, limit: number) {
    const rows = await releaseQuery()
      .where(or(like(schema.release.appId, `%${query}%`), eq(schema.release.version, query)))
      .orderBy(desc(schema.release.createdAt))
      .limit(limit)
    return rows.map((row) => ({
      ...row.release,
      name: row.name,
      publisherId: row.publisherId,
      publisher: row.publisher,
      repository: row.repository,
      format: row.format,
    }))
  },
  checks(id: string) {
    return db.select().from(schema.check).where(eq(schema.check.releaseId, id))
  },
  artifacts(id: string) {
    return db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, id))
  },
}

export const publishers = {
  async byId(id: string) {
    const row = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, id) })
    if (!row) return null
    const verification = await latestVerification(id)
    return { ...row, verification: verification?.status ?? null }
  },
  async search(query: string, limit: number) {
    const pattern = `%${query}%`
    const rows = await db
      .select()
      .from(schema.publisher)
      .where(or(like(schema.publisher.name, pattern), like(schema.publisher.slug, pattern)))
      .limit(limit)
    return rows.map((row) => ({ ...row, verification: null }))
  },
  namespaces(id: string) {
    return db.select().from(schema.namespace).where(eq(schema.namespace.publisherId, id))
  },
  members(id: string) {
    return db
      .select({ name: schema.user.name, email: schema.user.email, role: schema.member.role })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .where(eq(schema.member.publisherId, id))
  },
  apps(id: string) {
    return appQuery().where(eq(schema.app.publisherId, id))
  },
  trustedPublishers(id: string) {
    return db
      .select({ publisher: schema.trustedPublisher })
      .from(schema.trustedPublisher)
      .innerJoin(schema.app, eq(schema.app.id, schema.trustedPublisher.appId))
      .where(eq(schema.app.publisherId, id))
  },
}

export type PublisherView = NonNullable<Awaited<ReturnType<typeof publishers.byId>>>
