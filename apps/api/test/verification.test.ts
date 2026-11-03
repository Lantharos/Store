import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { approve, askForMore, reject, revoke, submit } from "../src/verification/decisions.ts"
import { canMove } from "../src/verification/states.ts"
import { publisherWithApp } from "./fixtures.ts"

async function request(status: typeof schema.publisherVerification.$inferInsert.status) {
  const { publisherId } = await publisherWithApp()
  const id = randomId()
  await db.insert(schema.publisherVerification).values({
    id,
    publisherId,
    status,
    legalName: "Mira Halvorsen",
    proofToken: randomId(24),
  })
  return { publisherId, id }
}

const statusOf = async (id: string) =>
  (await db.query.publisherVerification.findFirst({ where: eq(schema.publisherVerification.id, id) }))!.status
const verifiedAt = async (publisherId: string) =>
  (await db.query.publisher.findFirst({ where: eq(schema.publisher.id, publisherId) }))!.verifiedAt

describe("verification", () => {
  test("moves only along the review path", () => {
    expect(canMove("draft", "submit")).toBe(true)
    expect(canMove("draft", "approve")).toBe(false)
    expect(canMove("more-requested", "approve")).toBe(false)
    expect(canMove("more-requested", "reply")).toBe(true)
    expect(canMove("rejected", "reply")).toBe(false)
    expect(canMove("approved", "revoke")).toBe(true)
    expect(canMove("revoked", "approve")).toBe(false)
  })

  test("approval gives the checkmark and revoking takes it away", async () => {
    const { publisherId, id } = await request("open")
    await approve(publisherId, "Kristof")
    expect(await statusOf(id)).toBe("approved")
    expect(await verifiedAt(publisherId)).toBeInstanceOf(Date)
    await revoke(publisherId, "Kristof", "The domain changed hands")
    expect(await statusOf(id)).toBe("revoked")
    expect(await verifiedAt(publisherId)).toBeNull()
  })

  test("asking for more waits on the publisher, and nothing is approved meanwhile", async () => {
    const { publisherId, id } = await request("open")
    await askForMore(publisherId, "Kristof", "Can you add a document showing the trading name?")
    expect(await statusOf(id)).toBe("more-requested")
    await expect(approve(publisherId, "Kristof")).rejects.toThrow("can't be changed that way")
    const messages = await db
      .select()
      .from(schema.verificationMessage)
      .where(eq(schema.verificationMessage.verificationId, id))
    expect(messages.map((message) => message.author)).toEqual(["store"])
    await reject(publisherId, "Kristof", "No answer")
    expect(await statusOf(id)).toBe("rejected")
    expect(await verifiedAt(publisherId)).toBeNull()
  })

  test("a request can't be sent before the contact email is confirmed", async () => {
    const { publisherId, id } = await request("draft")
    await db
      .update(schema.publisherVerification)
      .set({
        website: "https://example.com",
        domains: [{ name: "example.com", proof: null, checked_at: null }],
        contactEmail: "mira@example.com",
      })
      .where(eq(schema.publisherVerification.id, id))
    const publisher = (await db.query.publisher.findFirst({ where: eq(schema.publisher.id, publisherId) }))!
    const verification = (await db.query.publisherVerification.findFirst({
      where: eq(schema.publisherVerification.id, id),
    }))!
    await expect(submit(publisher, verification)).rejects.toThrow("Confirm the contact email")
    expect(await statusOf(id)).toBe("draft")
  })
})
