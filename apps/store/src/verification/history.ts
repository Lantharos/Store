import type { VerificationCheck, VerificationEvent, VerificationEventKind } from "@schelf/protocol"
import { asc, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { randomId } from "../lib/ids.ts"
import type { VerificationRow } from "./facts.ts"

interface EventDetails {
  by?: string
  text?: string | null
  checks?: VerificationCheck[]
}

export function recordEvent(verificationId: string, kind: VerificationEventKind, details: EventDetails = {}) {
  return db.insert(schema.verificationEvent).values({
    id: randomId(),
    verificationId,
    kind,
    by: details.by ?? null,
    text: details.text ?? null,
    checks: details.checks ?? null,
  })
}

export function checksOf(verification: VerificationRow): VerificationCheck[] {
  return [
    ...verification.domains.map((domain) => ({
      label: `${domain.name} is yours`,
      passed: domain.proof !== null,
    })),
    { label: "The contact email is confirmed", passed: verification.contactConfirmedAt !== null },
    ...(verification.githubOrg
      ? [
          {
            label: `You own ${verification.githubOrg} on GitHub`,
            passed: verification.githubOrgProvenAt !== null,
          },
        ]
      : []),
  ]
}

export async function historyOf(verificationId: string): Promise<VerificationEvent[]> {
  const rows = await db
    .select()
    .from(schema.verificationEvent)
    .where(eq(schema.verificationEvent.verificationId, verificationId))
    .orderBy(asc(schema.verificationEvent.createdAt))
  return rows.map((row) => ({
    kind: row.kind,
    by: row.by,
    text: row.text,
    checks: row.checks,
    at: row.createdAt.toISOString(),
  }))
}
