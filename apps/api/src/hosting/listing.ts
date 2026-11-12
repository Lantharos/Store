import { waitUntil } from "cloudflare:workers"
import { DEFAULT_LOCALE, SHIPPED_STATUSES } from "@schelf/protocol"
import { and, eq, inArray } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { sendNotice } from "../mail/notices/send.ts"
import { listingMail } from "../mail/notices/templates/listing.ts"
import { recordHistory, tellOps } from "../ops/events.ts"
import { resignApp } from "../signing/queue.ts"
import type { AppRow } from "../signing/records.ts"
import { reindexApp } from "../storefront/indexing.ts"

export async function listingRefusal(app: AppRow) {
  if (app.visibility === "listed") return "It's listed already"
  if (app.listingRequestedAt) return "It's waiting for a reviewer already"
  const shipped = await db.$count(
    schema.release,
    and(eq(schema.release.appId, app.id), inArray(schema.release.status, [...SHIPPED_STATUSES])),
  )
  return shipped ? null : "Publish a release first; the reviewer looks at it with the listing"
}

export async function requestListing(app: AppRow, by: string) {
  const refusal = await listingRefusal(app)
  if (refusal) fail(409, refusal)
  await db
    .update(schema.app)
    .set({ listingRequestedAt: new Date(), listingItem: null })
    .where(eq(schema.app.id, app.id))
  tellOps({ type: "listing", app: app.id })
  recordHistory("app", app.id, "Asked to be listed", by)
}

export async function decideListing(
  appId: string,
  decision: { listed: boolean; by: string; reason?: string },
) {
  const [app] = await db
    .update(schema.app)
    .set({
      listingRequestedAt: null,
      listingItem: null,
      ...(decision.listed && { visibility: "listed" as const }),
    })
    .where(eq(schema.app.id, appId))
    .returning()
  if (!app) fail(404, "That project doesn't exist")
  if (decision.listed) await Promise.all([resignApp(appId), reindexApp(appId)])
  recordHistory("app", appId, decision.listed ? "Listed" : `Kept unlisted: ${decision.reason}`, decision.by)
  waitUntil(tellMembers(app, decision))
}

async function tellMembers(app: AppRow, decision: { listed: boolean; reason?: string }) {
  const rows = await db
    .select({ email: schema.user.email, publisher: schema.publisher.name, name: schema.listing.name })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.member.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(eq(schema.member.publisherId, app.publisherId))
  await Promise.all(
    rows.map((row) =>
      sendNotice(
        row.email,
        listingMail({
          appId: app.id,
          name: row.name ?? app.slug,
          publisher: row.publisher,
          listed: decision.listed,
          reason: decision.reason,
        }),
      ),
    ),
  )
}
