import type { Verification, VerificationState } from "@schelf/protocol"
import { asc, desc, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { iso } from "../lib/time.ts"
import type { PublisherRow } from "../publishers/access.ts"
import type { VerificationRow } from "./facts.ts"

export async function latestVerification(publisherId: string) {
  const row = await db.query.publisherVerification.findFirst({
    where: eq(schema.publisherVerification.publisherId, publisherId),
    orderBy: desc(schema.publisherVerification.createdAt),
  })
  return row ?? null
}

export async function currentVerification(publisherId: string) {
  const row = await latestVerification(publisherId)
  if (!row) fail(404, "Start a verification request first")
  return row
}

export async function verificationView(row: VerificationRow): Promise<Verification> {
  const [messages, documents] = await Promise.all([
    db
      .select()
      .from(schema.verificationMessage)
      .where(eq(schema.verificationMessage.verificationId, row.id))
      .orderBy(asc(schema.verificationMessage.createdAt)),
    db
      .select()
      .from(schema.verificationDocument)
      .where(eq(schema.verificationDocument.verificationId, row.id))
      .orderBy(asc(schema.verificationDocument.createdAt)),
  ])
  return {
    id: row.id,
    status: row.status,
    legal_name: row.legalName,
    website: row.website,
    domains: row.domains,
    proof_token: row.proofToken,
    contact_email: row.contactEmail,
    contact_confirmed: row.contactConfirmedAt !== null,
    github_org: row.githubOrg,
    github_org_proven: row.githubOrgProvenAt !== null,
    note: row.note,
    documents: documents.map((document) => ({ id: document.id, name: document.name, size: document.size })),
    messages: messages.map((message) => ({
      from: message.author,
      name: message.name,
      text: message.text,
      at: message.createdAt.toISOString(),
    })),
    reason: row.reason,
    submitted_at: iso(row.submittedAt),
    decided_at: iso(row.decidedAt),
  }
}

export async function verificationState(publisher: PublisherRow): Promise<VerificationState> {
  const row = await latestVerification(publisher.id)
  return { verified: publisher.verifiedAt !== null, current: row ? await verificationView(row) : null }
}
