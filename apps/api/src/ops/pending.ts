import type { Pult } from "@lantharos/pult"
import { and, eq, isNull } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { sendRelease, sendReport, sendVerification } from "./items.ts"

export async function deliverPending(pult: Pult) {
  const [reviews, reports, verifications] = await Promise.all([
    db
      .select({ releaseId: schema.review.releaseId, kind: schema.review.kind })
      .from(schema.review)
      .where(and(isNull(schema.review.pultItem), isNull(schema.review.decision))),
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
  ])
  await Promise.all([
    ...reviews.map((review) => sendRelease(pult, review.releaseId, review.kind)),
    ...reports.map((report) => sendReport(pult, report.id)),
    ...verifications.map((verification) => sendVerification(pult, verification.id)),
  ])
}
