import { type CustomDomainState, DOMAIN_TARGET, domainProofName } from "@schelf/protocol"
import { eq, sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { iso } from "../lib/time.ts"
import { recordHistory } from "../ops/events.ts"
import { checkDomain, type DomainRow } from "./check.ts"
import { deleteHostname } from "./cloudflare.ts"

export const domainOf = (appId: string) =>
  db.query.customDomain.findFirst({ where: eq(schema.customDomain.appId, appId) })

export const publisherDomainOf = (publisherId: string) =>
  db.query.customDomain.findFirst({ where: eq(schema.customDomain.publisherId, publisherId) })

export function domainState(row: DomainRow, verified: boolean): CustomDomainState {
  if (!verified)
    return {
      domain: row.domain,
      status: "paused",
      records: [],
      waiting: "Not serving links while the publisher isn't verified; it comes back once it is",
      checked_at: iso(row.checkedAt),
    }
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

export type DomainOwner = { appId: string } | { publisherId: string }

const ownerColumn = (owner: DomainOwner) =>
  "appId" in owner
    ? eq(schema.customDomain.appId, owner.appId)
    : eq(schema.customDomain.publisherId, owner.publisherId)

const historyOf = (owner: DomainOwner) =>
  "appId" in owner ? (["app", owner.appId] as const) : (["publisher", owner.publisherId] as const)

async function refuseTaken(owner: DomainOwner, domain: string) {
  const taken = await db.query.customDomain.findFirst({ where: eq(schema.customDomain.domain, domain) })
  const ours =
    taken && ("appId" in owner ? taken.appId === owner.appId : taken.publisherId === owner.publisherId)
  if (taken && !ours) fail(409, `${domain} is connected to another project or publisher on Schelf`)
}

export const UNVERIFIED_DOMAIN =
  "Custom domains come with a verified publisher. Ask for verification under Settings → Verification in the dashboard to connect one."

async function refuseUnverified(owner: DomainOwner) {
  const [row] = await db
    .select({ verifiedAt: schema.publisher.verifiedAt })
    .from(schema.publisher)
    .where(
      "publisherId" in owner
        ? eq(schema.publisher.id, owner.publisherId)
        : sql`${schema.publisher.id} = (select ${schema.app.publisherId} from ${schema.app} where ${schema.app.id} = ${owner.appId})`,
    )
  if (!row?.verifiedAt) fail(403, UNVERIFIED_DOMAIN)
}

export async function refuseDomainClaim(owner: DomainOwner, domain: string) {
  await refuseUnverified(owner)
  await refuseTaken(owner, domain)
}

export async function settleDomain(owner: DomainOwner, wanted: string | null, by: string) {
  const current = await db.query.customDomain.findFirst({ where: ownerColumn(owner) })
  if ((current?.domain ?? null) === wanted) return current ?? null
  if (wanted) await refuseDomainClaim(owner, wanted)
  if (current) await release(current)
  const [kind, id] = historyOf(owner)
  if (!wanted) {
    recordHistory(kind, id, `Stopped serving links on ${current!.domain}`, by)
    return null
  }
  const [row] = await db
    .insert(schema.customDomain)
    .values({ domain: wanted, ...owner, token: randomId(16) })
    .returning()
  recordHistory(kind, id, `Asked for ${wanted} to serve download links`, by)
  return checkDomain(row!)
}
