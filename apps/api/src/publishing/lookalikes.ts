import { env } from "cloudflare:workers"
import { AUTOMATIC_REVIEWER } from "@schelf/protocol"
import { and, eq, isNotNull, ne, sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import type { AppRow } from "../signing/records.ts"
import { searchKeys, storeKey } from "../storefront/search-index.ts"

export interface Lookalike {
  id: string
  name: string
}

const STORE_ORIGIN = "schelf:"

/** Listed apps and mirror entries named like `name`, leaving out the app itself and its publisher's other apps. */
export async function lookalikes(app: AppRow, name: string | undefined): Promise<Lookalike[]> {
  if (!name) return []
  const hits = (await searchKeys(name, 20)).filter((hit) => hit.key !== storeKey(app.id))
  const storeIds = hits.flatMap((hit) =>
    hit.key.startsWith(STORE_ORIGIN) ? [hit.key.slice(STORE_ORIGIN.length).toLowerCase()] : [],
  )
  const own = storeIds.length
    ? await db
        .select({ id: sql<string>`lower(${schema.app.id})` })
        .from(schema.app)
        .where(and(eq(schema.app.publisherId, app.publisherId), sql`lower(${schema.app.id}) in ${storeIds}`))
    : []
  const ours = new Set(own.map((row) => row.id))
  return hits
    .filter(
      (hit) =>
        !(hit.key.startsWith(STORE_ORIGIN) && ours.has(hit.key.slice(STORE_ORIGIN.length).toLowerCase())),
    )
    .map((hit) => ({ id: hit.key.slice(hit.key.indexOf(":") + 1), name: hit.name }))
}

/** The lookalikes a person approved an earlier release of the app with. */
export async function acceptedLookalikes(appId: string) {
  const rows = await db
    .select({ key: schema.check.detailKey })
    .from(schema.check)
    .innerJoin(schema.release, eq(schema.release.id, schema.check.releaseId))
    .where(
      and(
        eq(schema.release.appId, appId),
        eq(schema.check.name, "impersonation"),
        eq(schema.check.status, "warning"),
        isNotNull(schema.check.detailKey),
        isNotNull(schema.release.approvedAt),
        ne(schema.release.approvedBy, AUTOMATIC_REVIEWER),
      ),
    )
  const details = await Promise.all(
    rows.map(async (row) => (await env.BUCKET.get(row.key!))?.json<{ matches: Lookalike[] }>()),
  )
  return new Set(details.flatMap((detail) => detail?.matches.map((match) => match.id) ?? []))
}
