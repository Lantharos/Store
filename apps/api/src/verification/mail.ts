import { waitUntil } from "cloudflare:workers"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { sendNotice } from "../mail/notices/send.ts"
import { type VerificationOutcome, verificationMail } from "../mail/notices/templates/verification.ts"

function owners(publisherId: string) {
  return db
    .select({ email: schema.user.email, name: schema.publisher.name, slug: schema.publisher.slug })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.member.publisherId))
    .where(and(eq(schema.member.publisherId, publisherId), eq(schema.member.role, "owner")))
}

export function notifyVerification(publisherId: string, outcome: VerificationOutcome, message?: string) {
  waitUntil(
    owners(publisherId).then((rows) =>
      Promise.all(
        rows.map(({ email, name, slug }) =>
          sendNotice(email, verificationMail(outcome, { publisherId, name, slug, message })),
        ),
      ),
    ),
  )
}
