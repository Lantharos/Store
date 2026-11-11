import type { Pult } from "@lantharos/pult"
import { and, eq, isNotNull, isNull, lt } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { deliverMail } from "../mail/deliver.ts"
import { sendListing, sendRelease, sendReport, sendShell, sendVerification } from "./items.ts"

const MAIL_SETTLES_MS = 5 * 60_000

export async function deliverPending(pult: Pult) {
  const [reviews, shell, reports, verifications, listings, mail] = await Promise.all([
    db
      .select({ releaseId: schema.review.releaseId, kind: schema.review.kind })
      .from(schema.review)
      .where(and(isNull(schema.review.pultItem), isNull(schema.review.decision))),
    db
      .select({ id: schema.release.id })
      .from(schema.release)
      .where(and(eq(schema.release.shellReview, "waiting"), isNull(schema.release.shellItem))),
    db
      .select({ id: schema.report.id })
      .from(schema.report)
      .where(and(isNull(schema.report.pultItem), eq(schema.report.status, "open"))),
    db
      .select({ id: schema.publisherVerification.id })
      .from(schema.publisherVerification)
      .where(
        and(isNull(schema.publisherVerification.pultItem), eq(schema.publisherVerification.status, "open")),
      ),
    db
      .select({ id: schema.app.id })
      .from(schema.app)
      .where(and(isNotNull(schema.app.listingRequestedAt), isNull(schema.app.listingItem))),
    db
      .select()
      .from(schema.mail)
      .where(
        and(
          eq(schema.mail.direction, "in"),
          isNull(schema.mail.pultItem),
          lt(schema.mail.createdAt, new Date(Date.now() - MAIL_SETTLES_MS)),
        ),
      ),
  ])
  await Promise.all([
    ...reviews.map((review) => sendRelease(pult, review.releaseId, review.kind)),
    ...shell.map((release) => sendShell(pult, release.id)),
    ...reports.map((report) => sendReport(pult, report.id)),
    ...verifications.map((verification) => sendVerification(pult, verification.id)),
    ...listings.map((app) => sendListing(pult, app.id)),
    ...mail.map((row) => deliverMail(pult, row)),
  ])
}
