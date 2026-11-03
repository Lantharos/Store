import type { Developer, Namespace } from "@schelf/protocol"
import type { schema } from "../db/client.ts"
import { iso } from "../lib/time.ts"

export function developerView(row: typeof schema.developer.$inferSelect): Developer {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    github_login: row.githubLogin,
    agreement_version: row.agreementVersion,
    status: row.status,
  }
}

export function domainOf(prefix: string) {
  return prefix.split(".").reverse().join(".")
}

export function namespaceView(row: typeof schema.namespace.$inferSelect): Namespace {
  const githubPrefix = row.prefix.startsWith("io.github.")
  return {
    prefix: row.prefix,
    proof: row.proof,
    token: row.proofValue,
    verified: row.verifiedAt !== null,
    verified_at: iso(row.verifiedAt),
    checked_at: iso(row.checkedAt),
    instructions: githubPrefix
      ? null
      : {
          dns: `Add a TXT record on ${domainOf(row.prefix)} with the value schelf-verify=${row.proofValue}`,
          well_known: `Serve https://${domainOf(row.prefix)}/.well-known/schelf-store.txt containing ${row.proofValue}`,
        },
  }
}
