import { type CustomDomainState, DOMAIN_TARGET, domainProofName } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { randomId } from "../lib/ids.ts"
import { iso } from "../lib/time.ts"
import { recordHistory } from "../ops/events.ts"
import { checkDomain, type DomainRow } from "./check.ts"
import { deleteHostname } from "./cloudflare.ts"

export const domainOf = (appId: string) =>
  db.query.customDomain.findFirst({ where: eq(schema.customDomain.appId, appId) })

export function domainState(row: DomainRow): CustomDomainState {
  return {
    domain: row.domain,
    status: row.activeAt ? "active" : row.provenAt ? "connecting" : "proving",
    records: [
      { type: "TXT", name: domainProofName(row.domain), value: `schelf-verify=${row.token}` },
      { type: "CNAME", name: row.domain, value: DOMAIN_TARGET },
    ],
    waiting: row.activeAt ? null : row.waiting,
    checked_at: iso(row.checkedAt),
  }
}

async function release(row: DomainRow) {
  if (row.hostnameId) await deleteHostname(row.hostnameId)
  await db.delete(schema.customDomain).where(eq(schema.customDomain.domain, row.domain))
}

export async function settleDomain(appId: string, wanted: string | null, by: string) {
  const current = await domainOf(appId)
  if ((current?.domain ?? null) === wanted) return
  if (current) await release(current)
  if (!wanted) return recordHistory("app", appId, `Stopped serving links on ${current!.domain}`, by)
  const [row] = await db
    .insert(schema.customDomain)
    .values({ domain: wanted, appId, token: randomId(16) })
    .returning()
  recordHistory("app", appId, `Asked for ${wanted} to serve its download links`, by)
  await checkDomain(row!)
}
