import type { Pult } from "@lantharos/pult"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { releases } from "./data/releases.ts"
import { app } from "./define/app.ts"
import { reports, submissions, updates } from "./define/inboxes.ts"
import { publisher } from "./define/publisher.ts"
import { release as releaseResource } from "./define/release.ts"
import { verification } from "./define/verification.ts"
import type { HistoryEvent } from "./events.ts"

const RESOURCES = { app, release: releaseResource, publisher }

const FLAGGING_CHECKS: Partial<Record<string, string>> = {
  malware: "malware",
  impersonation: "impersonation",
}

async function tagsFor(release: NonNullable<Awaited<ReturnType<typeof releases.byId>>>) {
  const checks = await releases.checks(release.id)
  return [
    ...(release.permissionsWidened ? ["permissions"] : []),
    ...(release.origin === "token" ? ["uploaded"] : []),
    ...checks.flatMap((check) => {
      const flag = FLAGGING_CHECKS[check.name]
      return flag && check.status !== "passed" ? [flag] : []
    }),
  ]
}

export async function sendRelease(pult: Pult, releaseId: string, kind: "submission" | "update") {
  const release = await releases.byId(releaseId)
  if (!release) return
  const sent = await pult.send(kind === "submission" ? submissions : updates, {
    fingerprint: release.id,
    record: release.id,
    tags: await tagsFor(release),
    data: { app: release.appId, name: release.name, version: release.version, publisher: release.publisher },
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
    tags: [report.kind],
    data: { app: report.appId, kind: report.kind, email: report.reporterEmail, ...details },
  })
  await db.update(schema.report).set({ pultItem: sent.id }).where(eq(schema.report.id, report.id))
}

export async function sendVerification(
  pult: Pult,
  verificationId: string,
  message?: { from: string; text: string },
) {
  const row = await db.query.publisherVerification.findFirst({
    where: eq(schema.publisherVerification.id, verificationId),
  })
  if (!row) return
  const publisher = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, row.publisherId) })
  if (!publisher) return
  const failed = row.facts.filter((fact) => fact.result === "failed")
  const sent = await pult.send(verification, {
    fingerprint: row.id,
    record: publisher.id,
    tags: [
      ...(failed.length ? ["unproven"] : []),
      ...(failed.some((fact) => fact.check === "Impersonation" || fact.check === "Name")
        ? ["impersonation"]
        : []),
    ],
    data: {
      verification: row.id,
      name: publisher.name,
      legalName: row.legalName,
      email: row.contactEmail ?? "",
    },
  })
  if (row.pultItem !== sent.id)
    await db
      .update(schema.publisherVerification)
      .set({ pultItem: sent.id })
      .where(eq(schema.publisherVerification.id, row.id))
  if (message) await pult.receive({ thread: sent.id, from: message.from, text: message.text })
}

export function logHistory(pult: Pult, event: HistoryEvent) {
  return pult.log(RESOURCES[event.resource], event.id, event.text, { by: event.by })
}
