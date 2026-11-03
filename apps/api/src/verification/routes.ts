import {
  confirmContact,
  saveVerification,
  type VerificationDomain,
  type VerificationState,
  verificationReply,
} from "@schelf/protocol"
import { and, eq, isNotNull } from "drizzle-orm"
import { Hono } from "hono"
import { githubAccount } from "../dashboard/access.ts"
import { db, schema } from "../db/client.ts"
import { fail, readBody } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { allow, type PublisherVars } from "../publishers/access.ts"
import { confirmContactCode, sendContactCode } from "./contact.ts"
import { reply, submit } from "./decisions.ts"
import { addDocument, removeDocument } from "./documents.ts"
import { checkDomains, type VerificationRow } from "./facts.ts"
import { githubOrganisation, namespaceDomains } from "./proofs.ts"
import { currentVerification, latestVerification, verificationState } from "./records.ts"
import { editable, startsOver } from "./states.ts"

export const verificationRoutes = new Hono<PublisherVars>()

verificationRoutes.use("*", async (c, next) => {
  if (c.req.method !== "GET") allow(c.var.role, "verification")
  await next()
})

function state(c: { var: PublisherVars["Variables"] }): Promise<VerificationState> {
  return verificationState(c.var.publisher)
}

async function editing(publisherId: string) {
  const verification = await currentVerification(publisherId)
  editable(verification.status)
  return verification
}

function update(verification: VerificationRow, changes: Partial<VerificationRow>) {
  return db
    .update(schema.publisherVerification)
    .set(changes)
    .where(eq(schema.publisherVerification.id, verification.id))
}

verificationRoutes.get("/", async (c) => c.json(await state(c)))

verificationRoutes.post("/", async (c) => {
  const publisher = c.var.publisher
  const previous = await latestVerification(publisher.id)
  if (!startsOver(previous?.status)) fail(409, "There's already a request")
  const namespaces = await db
    .select({ prefix: schema.namespace.prefix })
    .from(schema.namespace)
    .where(and(eq(schema.namespace.publisherId, publisher.id), isNotNull(schema.namespace.verifiedAt)))
  const namespaceProofs = namespaceDomains(namespaces.map((row) => row.prefix)).map(
    (name): VerificationDomain => ({ name, proof: "namespace", checked_at: null }),
  )
  await db.insert(schema.publisherVerification).values({
    id: randomId(),
    publisherId: publisher.id,
    proofToken: previous?.proofToken ?? randomId(24),
    ...(previous
      ? {
          legalName: previous.legalName,
          website: previous.website,
          domains: previous.domains,
          contactEmail: previous.contactEmail,
          contactConfirmedAt: previous.contactConfirmedAt,
          githubOrg: previous.githubOrg,
          githubOrgProvenAt: previous.githubOrgProvenAt,
          note: previous.note,
        }
      : {
          legalName: publisher.kind === "organisation" ? publisher.name : "",
          website: publisher.website,
          domains: namespaceProofs,
        }),
  })
  return c.json(await state(c), 201)
})

verificationRoutes.patch("/", async (c) => {
  const input = await readBody(c, saveVerification)
  const verification = await editing(c.var.publisher.id)
  const known = new Map(verification.domains.map((domain) => [domain.name, domain]))
  const contactChanged =
    input.contact_email !== undefined && input.contact_email !== verification.contactEmail
  const githubChanged = input.github_org !== undefined && input.github_org !== verification.githubOrg
  await update(verification, {
    ...(input.legal_name !== undefined && { legalName: input.legal_name }),
    ...(input.website !== undefined && { website: input.website }),
    ...(input.note !== undefined && { note: input.note }),
    ...(input.domains && {
      domains: [...new Set(input.domains)].map(
        (name): VerificationDomain => known.get(name) ?? { name, proof: null, checked_at: null },
      ),
    }),
    ...(contactChanged && {
      contactEmail: input.contact_email,
      contactConfirmedAt: null,
      contactCodeHash: null,
      contactCodeExpiresAt: null,
    }),
    ...(githubChanged && { githubOrg: input.github_org, githubOrgProvenAt: null }),
  })
  return c.json(await state(c))
})

verificationRoutes.post("/check", async (c) => {
  const verification = await editing(c.var.publisher.id)
  await update(verification, { domains: await checkDomains(verification) })
  return c.json(await state(c))
})

verificationRoutes.post("/contact/code", async (c) => {
  await sendContactCode(c.var.publisher, await editing(c.var.publisher.id))
  return c.body(null, 204)
})

verificationRoutes.post("/contact/confirm", async (c) => {
  const { code } = await readBody(c, confirmContact)
  await confirmContactCode(await editing(c.var.publisher.id), code)
  return c.json(await state(c))
})

verificationRoutes.post("/github", async (c) => {
  const verification = await editing(c.var.publisher.id)
  if (!verification.githubOrg) fail(422, "Add the GitHub organisation first")
  const account = await githubAccount(c.var.viewer.id)
  if (!account) fail(409, "Connect your GitHub account in Account first")
  const { owns } = await githubOrganisation(verification.githubOrg, account)
  if (!owns) fail(422, `${account.login} isn't an owner of ${verification.githubOrg} on GitHub`)
  await update(verification, { githubOrgProvenAt: new Date() })
  return c.json(await state(c))
})

verificationRoutes.post("/documents", async (c) => {
  await addDocument(await editing(c.var.publisher.id), c.req.raw, c.req.query("name") ?? "")
  return c.json(await state(c), 201)
})

verificationRoutes.delete("/documents/:document", async (c) => {
  await removeDocument(await editing(c.var.publisher.id), c.req.param("document"))
  return c.json(await state(c))
})

verificationRoutes.post("/submit", async (c) => {
  await submit(c.var.publisher, await currentVerification(c.var.publisher.id))
  return c.json(await state(c))
})

verificationRoutes.post("/reply", async (c) => {
  const { text } = await readBody(c, verificationReply)
  const viewer = c.var.viewer
  await reply(
    c.var.publisher,
    await currentVerification(c.var.publisher.id),
    { from: "publisher", name: viewer.name, email: viewer.email },
    text,
  )
  return c.json(await state(c))
})
