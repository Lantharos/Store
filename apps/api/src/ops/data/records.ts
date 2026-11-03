import { type AppStatus, DEFAULT_LOCALE } from "@schelf/protocol"
import { and, desc, eq, like, or, sql } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"
import { installsSince } from "../../signing/records.ts"

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
      developerId: schema.developer.id,
      developer: schema.developer.name,
      createdAt: schema.app.createdAt,
    })
    .from(schema.app)
    .innerJoin(schema.developer, eq(schema.developer.id, schema.app.developerId))
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
      developerId: schema.app.developerId,
      developer: schema.developer.name,
      repository: schema.app.repository,
      format: schema.app.format,
    })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .innerJoin(schema.developer, eq(schema.developer.id, schema.app.developerId))
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
          developerId: row.developerId,
          developer: row.developer,
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
      developerId: row.developerId,
      developer: row.developer,
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

export const developers = {
  async byId(id: string) {
    const row = await db.query.developer.findFirst({ where: eq(schema.developer.id, id) })
    return row ?? null
  },
  search(query: string, limit: number) {
    const pattern = `%${query}%`
    return db
      .select()
      .from(schema.developer)
      .where(or(like(schema.developer.name, pattern), like(schema.developer.slug, pattern)))
      .limit(limit)
  },
  namespaces(id: string) {
    return db.select().from(schema.namespace).where(eq(schema.namespace.developerId, id))
  },
  apps(id: string) {
    return appQuery().where(eq(schema.app.developerId, id))
  },
  publishers(id: string) {
    return db
      .select({ publisher: schema.trustedPublisher })
      .from(schema.trustedPublisher)
      .innerJoin(schema.app, eq(schema.app.id, schema.trustedPublisher.appId))
      .where(eq(schema.app.developerId, id))
  },
}
