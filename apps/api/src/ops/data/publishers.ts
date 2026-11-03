import type { PublisherKind, VerificationStatus } from "@schelf/protocol"
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, like, ne, or, type SQL, sql } from "drizzle-orm"
import { db, schema } from "../../db/client.ts"

const now = sql`(strftime('%s', 'now') * 1000)`
const appsOf = sql`(select ${schema.app.id} from ${schema.app} where ${schema.app.publisherId} = ${schema.publisher.id})`

function publisherQuery() {
  return db
    .select({
      publisher: schema.publisher,
      owner: schema.user.name,
      apps: sql<number>`(select count(*) from ${schema.app} where ${schema.app.publisherId} = ${schema.publisher.id})`,
      activeTokens: sql<number>`(select count(*) from ${schema.token} where ${schema.token.publisherId} = ${schema.publisher.id} and ${schema.token.revokedAt} is null and ${schema.token.expiresAt} > ${now})`,
      trustedPublishers: sql<number>`(select count(*) from ${schema.trustedPublisher} where ${schema.trustedPublisher.appId} in ${appsOf})`,
      verification: sql<VerificationStatus | null>`(select ${schema.publisherVerification.status} from ${schema.publisherVerification} where ${schema.publisherVerification.publisherId} = ${schema.publisher.id} order by ${schema.publisherVerification.createdAt} desc limit 1)`,
    })
    .from(schema.publisher)
    .innerJoin(schema.user, eq(schema.user.id, schema.publisher.ownerId))
}

type Row = Awaited<ReturnType<ReturnType<typeof publisherQuery>["execute"]>>[number]

function view({ publisher, ...counts }: Row) {
  return { ...publisher, ...counts }
}

export type PublisherView = ReturnType<typeof view>

function matching(query: string): SQL | undefined {
  if (!query) return undefined
  const pattern = `%${query}%`
  return or(
    like(schema.publisher.name, pattern),
    like(schema.publisher.slug, pattern),
    inArray(
      schema.publisher.id,
      db
        .select({ id: schema.member.publisherId })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(or(like(schema.user.email, pattern), like(schema.user.name, pattern))),
    ),
    inArray(
      schema.publisher.id,
      db
        .select({ id: schema.namespace.publisherId })
        .from(schema.namespace)
        .where(like(schema.namespace.prefix, pattern)),
    ),
  )
}

export interface PublisherFilters {
  status?: "active" | "suspended"
  kind?: PublisherKind
  verified?: boolean
}

export const publishers = {
  async byId(id: string) {
    const [row] = await publisherQuery().where(eq(schema.publisher.id, id))
    return row ? view(row) : null
  },
  async search(query: string, limit: number) {
    return (await publisherQuery().where(matching(query)).limit(limit)).map(view)
  },
  async browse(query: string, filters: PublisherFilters, cursor: string | null, limit: number) {
    const offset = Number(cursor ?? 0)
    const rows = await publisherQuery()
      .where(
        and(
          matching(query),
          filters.status ? eq(schema.publisher.status, filters.status) : undefined,
          filters.kind ? eq(schema.publisher.kind, filters.kind) : undefined,
          filters.verified === undefined
            ? undefined
            : filters.verified
              ? isNotNull(schema.publisher.verifiedAt)
              : isNull(schema.publisher.verifiedAt),
        ),
      )
      .orderBy(desc(schema.publisher.createdAt))
      .limit(limit)
      .offset(offset)
    return { records: rows.map(view), cursor: rows.length === limit ? String(offset + limit) : null }
  },
  members(id: string) {
    return db
      .select({
        name: schema.user.name,
        email: schema.user.email,
        github: schema.user.githubLogin,
        role: schema.member.role,
        joined: schema.member.createdAt,
      })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .where(eq(schema.member.publisherId, id))
      .orderBy(asc(schema.member.createdAt))
  },
  namespaces(id: string) {
    return db
      .select()
      .from(schema.namespace)
      .where(eq(schema.namespace.publisherId, id))
      .orderBy(asc(schema.namespace.prefix))
  },
  trustedPublishers(id: string) {
    return db
      .select({ rule: schema.trustedPublisher, app: schema.app.id })
      .from(schema.trustedPublisher)
      .innerJoin(schema.app, eq(schema.app.id, schema.trustedPublisher.appId))
      .where(eq(schema.app.publisherId, id))
      .orderBy(asc(schema.app.id))
  },
  activeTokens(id: string) {
    return db
      .select()
      .from(schema.token)
      .where(
        and(
          eq(schema.token.publisherId, id),
          isNull(schema.token.revokedAt),
          gt(schema.token.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.token.createdAt))
  },
  verificationHistory(id: string) {
    return db
      .select({
        kind: schema.verificationEvent.kind,
        by: schema.verificationEvent.by,
        text: schema.verificationEvent.text,
        at: schema.verificationEvent.createdAt,
      })
      .from(schema.verificationEvent)
      .innerJoin(
        schema.publisherVerification,
        eq(schema.publisherVerification.id, schema.verificationEvent.verificationId),
      )
      .where(
        and(eq(schema.publisherVerification.publisherId, id), ne(schema.verificationEvent.kind, "checked")),
      )
      .orderBy(desc(schema.verificationEvent.createdAt))
      .limit(30)
  },
}
