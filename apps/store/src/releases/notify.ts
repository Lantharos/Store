import { waitUntil } from "cloudflare:workers"
import { DEFAULT_LOCALE } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { sendNotice } from "../mail/notices/send.ts"
import { type ReleaseOutcome, releaseMail } from "../mail/notices/templates/releases.ts"
import { mediaUrl } from "../signing/records.ts"

function recipients(releaseId: string) {
  return db
    .select({
      email: schema.user.email,
      appId: schema.release.appId,
      version: schema.release.version,
      rolloutPercent: schema.release.rolloutPercent,
      name: schema.listing.name,
      iconKey: schema.listingMeta.iconKey,
      publisher: schema.publisher.name,
    })
    .from(schema.release)
    .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .innerJoin(schema.member, eq(schema.member.publisherId, schema.app.publisherId))
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .leftJoin(schema.listingMeta, eq(schema.listingMeta.appId, schema.app.id))
    .where(eq(schema.release.id, releaseId))
}

export function notifyPublisher(releaseId: string, outcome: ReleaseOutcome, message?: string) {
  waitUntil(
    recipients(releaseId).then((rows) =>
      Promise.all(
        rows.map(({ email, name, iconKey, ...release }) =>
          sendNotice(
            email,
            releaseMail(outcome, {
              ...release,
              releaseId,
              name: name ?? release.appId,
              icon: mediaUrl(iconKey),
              message,
            }),
          ),
        ),
      ),
    ),
  )
}
