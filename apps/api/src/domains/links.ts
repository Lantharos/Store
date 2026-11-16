import { and, eq, isNotNull, or } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { defaultRoot } from "../hosting/serving/addresses.ts"
import { edgeValue } from "../lib/edge-cache.ts"
import type { AppRow } from "../signing/records.ts"

async function customRoot(app: Pick<AppRow, "id" | "publisherId" | "slug">) {
  const rows = await db
    .select({ domain: schema.customDomain.domain, appId: schema.customDomain.appId })
    .from(schema.customDomain)
    .innerJoin(schema.publisher, eq(schema.publisher.id, app.publisherId))
    .where(
      and(
        isNotNull(schema.customDomain.activeAt),
        isNotNull(schema.publisher.verifiedAt),
        or(eq(schema.customDomain.appId, app.id), eq(schema.customDomain.publisherId, app.publisherId)),
      ),
    )
  const own = rows.find((row) => row.appId === app.id)
  if (own) return `https://${own.domain}`
  const publisher = rows.find((row) => row.appId === null)
  return publisher ? `https://${publisher.domain}/${app.slug}` : null
}

/** Where the project's links start: its own domain, else its publisher's, else null for dl.schelf.store. */
export function customLinkRoot(app: Pick<AppRow, "id" | "publisherId" | "slug">) {
  return edgeValue(`https://roots.schelf.internal/${encodeURIComponent(app.id)}/${app.slug}`, () =>
    customRoot(app),
  )
}

export async function linkRoot(app: Pick<AppRow, "id" | "publisherId" | "slug">, publisherSlug: string) {
  return (await customLinkRoot(app)) ?? defaultRoot(app, publisherSlug)
}
