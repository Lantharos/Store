import { b, inbox } from "@lantharos/pult"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, schema } from "../../db/client.ts"
import type { VerificationFact } from "../../db/schema/verification.ts"
import { storeMessage } from "../../verification/decisions.ts"
import { documentFiles } from "../../verification/documents.ts"
import { publisher } from "./publisher.ts"

const MARKS: Record<VerificationFact["result"], string> = {
  passed: "passed",
  failed: "failed",
  noted: "noted",
}

export async function verificationBlocks(id: string) {
  const verification = await db.query.publisherVerification.findFirst({
    where: eq(schema.publisherVerification.id, id),
  })
  if (!verification) return [b.markdown("This request no longer exists.")]
  const [owner, messages, documents] = await Promise.all([
    db.query.publisher.findFirst({ where: eq(schema.publisher.id, verification.publisherId) }),
    db
      .select()
      .from(schema.verificationMessage)
      .where(eq(schema.verificationMessage.verificationId, id))
      .orderBy(schema.verificationMessage.createdAt),
    documentFiles(id),
  ])
  const failed = verification.facts.filter((fact) => fact.result === "failed").length
  return [
    b.stats({
      Passed: verification.facts.filter((fact) => fact.result === "passed").length,
      Failed: failed,
      Messages: messages.length,
    }),
    b.fields({
      publisher: b.ref("publisher", verification.publisherId, owner?.name),
      "legal name": verification.legalName,
      website: verification.website ?? undefined,
      domains: verification.domains.map((domain) => domain.name).join(", "),
      contact: verification.contactEmail ? b.sensitive(verification.contactEmail) : undefined,
      github: verification.githubOrg ? `https://github.com/${verification.githubOrg}` : undefined,
      page: owner ? `https://schelf.store/publishers/${owner.slug}` : undefined,
    }),
    b.table(
      verification.facts.map((fact) => ({
        check: fact.check,
        result: MARKS[fact.result],
        detail: fact.detail,
      })),
    ),
    ...(verification.note ? [b.markdown(`**In their words**\n\n${verification.note}`)] : []),
    ...documents.map((document) => b.attachment(document)),
    ...messages.map((message) =>
      b.markdown(
        `**${message.author === "store" ? `${message.name} (Schelf)` : message.name}**\n\n${message.text}`,
      ),
    ),
  ]
}

export const verification = inbox("verification", {
  icon: "shield",
  resource: publisher,
  states: ["open", "more requested", "approved", "rejected"],
  closed: ["more requested", "approved", "rejected"],
  sla: { open: "3d" },
  data: z.object({ verification: z.string(), name: z.string(), legalName: z.string(), email: z.string() }),
  title: (data) => `Verify ${data.name} (${data.legalName})`,
  reply: {
    to: (item) => item.data.email,
    send: ({ item, text, actor }) => storeMessage(item.data.verification, actor.name, text),
  },
  render: (item) => verificationBlocks(item.data.verification),
})
