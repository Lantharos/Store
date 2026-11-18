import { DOMAIN_TARGET, domainProofName } from "@schelf/protocol"
import { eq, isNull } from "drizzle-orm"
import { dnsHas } from "../dashboard/account/proofs.ts"
import { db, schema } from "../db/client.ts"
import { recordHistory } from "../ops/events.ts"
import { createHostname, hostname, hostnamesConfigured } from "./cloudflare.ts"

export type DomainRow = typeof schema.customDomain.$inferSelect

const NOT_SWITCHED_ON = "Custom domains aren't switched on for Schelf yet; it connects once they are"

async function connect(row: DomainRow) {
  if (!hostnamesConfigured()) return { waiting: NOT_SWITCHED_ON }
  if (!row.hostnameId) {
    const created = await createHostname(row.domain)
    return { hostnameId: created.id, waiting: `Point ${row.domain} at ${DOMAIN_TARGET} with a CNAME record` }
  }
  const found = await hostname(row.hostnameId)
  if (found.status === "active" && found.ssl?.status === "active")
    return { activeAt: new Date(), waiting: null }
  return {
    waiting:
      found.verification_errors?.[0] ??
      (found.status === "active"
        ? "Its certificate is being issued; this takes a few minutes"
        : `Point ${row.domain} at ${DOMAIN_TARGET} with a CNAME record`),
  }
}

export async function checkDomain(row: DomainRow) {
  const proven =
    row.provenAt ??
    ((await dnsHas(domainProofName(row.domain), row.token).catch(() => false)) ? new Date() : null)
  const next = proven
    ? await connect({ ...row, provenAt: proven }).catch((error: Error) => ({ waiting: error.message }))
    : { waiting: `Add the TXT record ${domainProofName(row.domain)} to prove the domain is yours` }
  const [updated] = await db
    .update(schema.customDomain)
    .set({ provenAt: proven, ...next, checkedAt: new Date() })
    .where(eq(schema.customDomain.domain, row.domain))
    .returning()
  if (updated?.activeAt && !row.activeAt)
    recordHistory(
      row.appId ? "app" : "publisher",
      (row.appId ?? row.publisherId)!,
      `${row.domain} serves download links`,
    )
  return updated!
}

export async function checkDomains() {
  const unfinished = await db.select().from(schema.customDomain).where(isNull(schema.customDomain.activeAt))
  for (const row of unfinished) await checkDomain(row)
}
