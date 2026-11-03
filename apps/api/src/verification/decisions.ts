import { domainCovers } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { tellOps } from "../ops/events.ts"
import type { PublisherRow } from "../publishers/access.ts"
import { resignPublisher } from "../signing/queue.ts"
import { checkDomains, gatherFacts, type VerificationRow } from "./facts.ts"
import { notifyVerification } from "./mail.ts"
import { currentVerification } from "./records.ts"
import { moved, type VerificationMove } from "./states.ts"

type Author = { from: "publisher" | "store"; name: string }

async function publisherOf(id: string) {
  const publisher = await db.query.publisher.findFirst({ where: eq(schema.publisher.id, id) })
  if (!publisher) fail(404, "That publisher doesn't exist")
  return publisher
}

function message(verificationId: string, author: Author, text: string) {
  return db
    .insert(schema.verificationMessage)
    .values({ id: randomId(), verificationId, author: author.from, name: author.name, text })
}

async function refreshed(publisher: PublisherRow, verification: VerificationRow) {
  const domains = await checkDomains(verification)
  const checked = { ...verification, domains }
  return { domains, facts: await gatherFacts(publisher, checked) }
}

function ready(verification: VerificationRow) {
  if (!verification.legalName) fail(422, "Add the legal or trading name")
  if (!verification.website) fail(422, "Add the website")
  if (!verification.domains.length) fail(422, "Add at least one domain")
  if (!verification.contactConfirmedAt) fail(422, "Confirm the contact email with its code")
  const host = verification.contactEmail!.split("@")[1]!
  if (!verification.domains.some((domain) => domainCovers(domain.name, host)))
    fail(422, "The contact email needs to be on one of the domains")
}

export async function submit(publisher: PublisherRow, verification: VerificationRow) {
  ready(verification)
  const status = moved(verification.status, "submit")
  const update = { ...(await refreshed(publisher, verification)), status, submittedAt: new Date() }
  await db
    .update(schema.publisherVerification)
    .set(update)
    .where(eq(schema.publisherVerification.id, verification.id))
  tellOps({ type: "verification", verification: verification.id })
  return { ...verification, ...update }
}

export async function reply(
  publisher: PublisherRow,
  verification: VerificationRow,
  author: Author & { email: string },
  text: string,
) {
  const status = moved(verification.status, "reply")
  const update = { ...(await refreshed(publisher, verification)), status }
  await db.batch([
    db
      .update(schema.publisherVerification)
      .set(update)
      .where(eq(schema.publisherVerification.id, verification.id)),
    message(verification.id, author, text),
  ])
  tellOps({ type: "verification", verification: verification.id, message: { from: author.email, text } })
  return { ...verification, ...update }
}

async function decide(publisherId: string, move: VerificationMove, by: string, reason: string | null) {
  const verification = await currentVerification(publisherId)
  const status = moved(verification.status, move)
  const now = new Date()
  await db
    .update(schema.publisherVerification)
    .set({ status, decidedBy: by, decidedAt: now, reason })
    .where(eq(schema.publisherVerification.id, verification.id))
  return { verification, now }
}

export async function approve(publisherId: string, by: string) {
  const publisher = await publisherOf(publisherId)
  const { now } = await decide(publisherId, "approve", by, null)
  await db.update(schema.publisher).set({ verifiedAt: now }).where(eq(schema.publisher.id, publisherId))
  await resignPublisher(publisherId)
  notifyVerification(publisherId, "approved")
  return `${publisher.name} is verified`
}

export async function reject(publisherId: string, by: string, reason: string) {
  const publisher = await publisherOf(publisherId)
  await decide(publisherId, "reject", by, reason)
  notifyVerification(publisherId, "rejected", reason)
  return `Declined to verify ${publisher.name}`
}

export async function revoke(publisherId: string, by: string, reason: string) {
  const publisher = await publisherOf(publisherId)
  await decide(publisherId, "revoke", by, reason)
  await db.update(schema.publisher).set({ verifiedAt: null }).where(eq(schema.publisher.id, publisherId))
  await resignPublisher(publisherId)
  notifyVerification(publisherId, "revoked", reason)
  return `${publisher.name} is no longer verified`
}

export async function askForMore(publisherId: string, by: string, text: string) {
  const publisher = await publisherOf(publisherId)
  const verification = await currentVerification(publisherId)
  const status = moved(verification.status, "askForMore")
  await db.batch([
    db
      .update(schema.publisherVerification)
      .set({ status })
      .where(eq(schema.publisherVerification.id, verification.id)),
    message(verification.id, { from: "store", name: by }, text),
  ])
  notifyVerification(publisherId, "more-requested", text)
  return `Asked ${publisher.name} for more`
}

export async function storeMessage(verificationId: string, by: string, text: string) {
  const verification = await db.query.publisherVerification.findFirst({
    where: eq(schema.publisherVerification.id, verificationId),
  })
  if (!verification) return
  await message(verification.id, { from: "store", name: by }, text)
  notifyVerification(verification.publisherId, "message", text)
}

export async function recheck(publisherId: string) {
  const publisher = await publisherOf(publisherId)
  const verification = await currentVerification(publisherId)
  await db
    .update(schema.publisherVerification)
    .set(await refreshed(publisher, verification))
    .where(eq(schema.publisherVerification.id, verification.id))
  tellOps({ type: "verification", verification: verification.id })
  return `Checked ${publisher.name} again`
}
