import type { Pult } from "@lantharos/pult"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { releases } from "./data/records.ts"
import { reports, submissions, updates } from "./define/inboxes.ts"

export async function sendRelease(pult: Pult, releaseId: string, kind: "submission" | "update") {
  const release = await releases.byId(releaseId)
  if (!release) return
  const sent = await pult.send(kind === "submission" ? submissions : updates, {
    fingerprint: release.id,
    record: release.id,
    tags: [
      ...(release.permissionsWidened ? ["permissions"] : []),
      ...(release.origin === "token" ? ["uploaded"] : []),
    ],
    data: { app: release.appId, name: release.name, version: release.version, developer: release.developer },
  })
  await db.update(schema.review).set({ pultItem: sent.id }).where(eq(schema.review.releaseId, release.id))
}

export async function sendReport(pult: Pult, reportId: string) {
  const report = await db.query.report.findFirst({ where: eq(schema.report.id, reportId) })
  if (!report) return
  const details = JSON.parse(report.details) as {
    reason: string
    explanation: string
    location: string | null
    name: string | null
  }
  const sent = await pult.send(reports, {
    record: report.appId,
    data: { app: report.appId, kind: report.kind, email: report.reporterEmail, ...details },
  })
  await db.update(schema.report).set({ pultItem: sent.id }).where(eq(schema.report.id, report.id))
}
