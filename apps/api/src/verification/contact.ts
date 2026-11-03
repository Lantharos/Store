import { env, waitUntil } from "cloudflare:workers"
import { sha256Hex } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import type { PublisherRow } from "../publishers/access.ts"
import type { VerificationRow } from "./facts.ts"

const CODE_MINUTES = 15

const hashOf = (verification: VerificationRow, code: string) => sha256Hex(`${verification.id}:${code}`)

function sixDigits() {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return String(value! % 1_000_000).padStart(6, "0")
}

export async function sendContactCode(publisher: PublisherRow, verification: VerificationRow) {
  const email = verification.contactEmail
  if (!email) fail(422, "Add a contact email first")
  if (!(await env.AUTH_LIMIT.limit({ key: `contact:${verification.id}` })).success)
    fail(429, "Too many codes, try again in a minute")
  const code = sixDigits()
  await db
    .update(schema.publisherVerification)
    .set({
      contactCodeHash: await hashOf(verification, code),
      contactCodeExpiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    })
    .where(eq(schema.publisherVerification.id, verification.id))
  waitUntil(
    env.EMAIL.send({
      from: env.NOTIFY_FROM,
      to: email,
      subject: `${code} confirms ${email} for ${publisher.name}`,
      text: `Enter this code on schelf.store to confirm ${email} as the contact for verifying ${publisher.name}:\n\n${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
    }),
  )
}

export async function confirmContactCode(verification: VerificationRow, code: string) {
  if (!(await env.AUTH_LIMIT.limit({ key: `confirm:${verification.id}` })).success)
    fail(429, "Too many tries, wait a minute")
  const expired = !verification.contactCodeExpiresAt || verification.contactCodeExpiresAt < new Date()
  if (expired || verification.contactCodeHash !== (await hashOf(verification, code)))
    fail(422, "That code didn't work; send a new one if it's more than 15 minutes old")
  const confirmed = { contactConfirmedAt: new Date(), contactCodeHash: null, contactCodeExpiresAt: null }
  await db
    .update(schema.publisherVerification)
    .set(confirmed)
    .where(eq(schema.publisherVerification.id, verification.id))
  return { ...verification, ...confirmed }
}
