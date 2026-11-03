import { waitUntil } from "cloudflare:workers"
import { DEFAULT_LOCALE, type ReportRequest } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { sendNotice } from "../mail/notices/send.ts"
import { reportReceived } from "../mail/notices/templates/report.ts"

async function appName(appId: string) {
  const listing = await db.query.listing.findFirst({
    columns: { name: true },
    where: and(eq(schema.listing.appId, appId), eq(schema.listing.locale, DEFAULT_LOCALE)),
  })
  return listing?.name ?? appId
}

export function confirmReport(
  email: string,
  report: { id: string; app: string; kind: ReportRequest["kind"] },
) {
  waitUntil(appName(report.app).then((app) => sendNotice(email, reportReceived({ ...report, app }))))
}
