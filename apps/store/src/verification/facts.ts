import { domainCovers, type VerificationDomain } from "@schelf/protocol"
import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import type { VerificationFact } from "../db/schema/verification.ts"
import { DAY_MS } from "../lib/time.ts"
import type { PublisherRow } from "../publishers/access.ts"
import { installsSince } from "../signing/records.ts"
import { githubOrganisation, namespaceDomains, proveDomain, registeredAt } from "./proofs.ts"

export type VerificationRow = typeof schema.publisherVerification.$inferSelect

const YOUNG_DOMAIN_DAYS = 180
const PROOF_NAMES = {
  dns: "a DNS record",
  "well-known": "a file on the site",
  namespace: "its proven namespace",
}

const fact = (check: string, result: VerificationFact["result"], detail: string): VerificationFact => ({
  check,
  result,
  detail,
})

const day = (date: Date) => date.toISOString().slice(0, 10)
const age = (date: Date, now: Date) => {
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS)
  return days >= 730
    ? `${Math.floor(days / 365)} years`
    : days >= 60
      ? `${Math.floor(days / 30)} months`
      : `${days} days`
}

async function provenNamespaces(publisherId: string) {
  const rows = await db
    .select({ prefix: schema.namespace.prefix })
    .from(schema.namespace)
    .where(and(eq(schema.namespace.publisherId, publisherId), isNotNull(schema.namespace.verifiedAt)))
  return rows.map((row) => row.prefix)
}

export async function checkDomains(verification: VerificationRow, now = new Date()) {
  const proven = namespaceDomains(await provenNamespaces(verification.publisherId))
  return Promise.all(
    verification.domains.map(
      async (domain): Promise<VerificationDomain> => ({
        name: domain.name,
        proof: await proveDomain(domain.name, verification.proofToken, proven),
        checked_at: now.toISOString(),
      }),
    ),
  )
}

function domainFacts(domains: VerificationDomain[], registered: (Date | null)[], now: Date) {
  return domains.flatMap((domain, index) => {
    const since = registered[index]
    return [
      domain.proof
        ? fact(`Owns ${domain.name}`, "passed", `Proven by ${PROOF_NAMES[domain.proof]}`)
        : fact(
            `Owns ${domain.name}`,
            "failed",
            "No DNS record or file with the token, and no proven namespace",
          ),
      since
        ? fact(
            `Age of ${domain.name}`,
            now.getTime() - since.getTime() < YOUNG_DOMAIN_DAYS * DAY_MS ? "failed" : "passed",
            `Registered ${day(since)}, ${age(since, now)} ago`,
          )
        : fact(`Age of ${domain.name}`, "noted", "The registry didn't say when it was registered"),
    ]
  })
}

function namespaceFacts(prefixes: string[], domains: string[]) {
  return prefixes.map((prefix) => {
    if (prefix.startsWith("io.github.")) return fact(`Namespace ${prefix}`, "noted", "A GitHub namespace")
    const matches = namespaceDomains([prefix]).some((domain) =>
      domains.some((given) => domainCovers(domain, given) || domainCovers(given, domain)),
    )
    return matches
      ? fact(`Namespace ${prefix}`, "passed", "Proven, and matches a domain given")
      : fact(`Namespace ${prefix}`, "noted", "Proven, but not one of the domains given")
  })
}

function contactFacts(verification: VerificationRow, domains: string[]) {
  const email = verification.contactEmail
  if (!email) return [fact("Contact email", "failed", "None given")]
  const host = email.split("@")[1] ?? ""
  return [
    verification.contactConfirmedAt
      ? fact(
          "Contact email",
          "passed",
          `${email} confirmed by code on ${day(verification.contactConfirmedAt)}`,
        )
      : fact("Contact email", "failed", `${email} isn't confirmed`),
    domains.some((domain) => domainCovers(domain, host))
      ? fact("Email on the domain", "passed", `${host} is one of the domains given`)
      : fact("Email on the domain", "failed", `${host} isn't one of the domains given`),
  ]
}

function websiteFact(website: string | null, domains: string[]) {
  if (!website) return fact("Website", "failed", "None given")
  const host = new URL(website).hostname
  return domains.some((domain) => domainCovers(domain, host))
    ? fact("Website", "passed", `${website} is on a domain given`)
    : fact("Website", "failed", `${website} isn't on any of the domains given`)
}

function githubFact(verification: VerificationRow, createdAt: Date | null, now: Date) {
  if (!verification.githubOrg) return []
  const created = createdAt ? `, created ${day(createdAt)} (${age(createdAt, now)} ago)` : ""
  return [
    verification.githubOrgProvenAt
      ? fact(`GitHub ${verification.githubOrg}`, "passed", `Owned by the person asking${created}`)
      : fact(`GitHub ${verification.githubOrg}`, "failed", `Not proven${created}`),
  ]
}

async function appFacts(publisherId: string) {
  const apps = await db
    .select({ id: schema.app.id })
    .from(schema.app)
    .where(and(eq(schema.app.publisherId, publisherId), eq(schema.app.status, "published")))
  const installs = await installsSince(
    apps.map((app) => app.id),
    30,
  )
  const total = [...installs.values()].reduce((sum, count) => sum + count, 0)
  return fact("Apps", "noted", `${apps.length} listed, ${total} installs in the last 30 days`)
}

async function impersonationFacts(publisher: PublisherRow, domains: string[]) {
  const [flagged, sameName, verified] = await Promise.all([
    db
      .select({ app: schema.release.appId })
      .from(schema.check)
      .innerJoin(schema.release, eq(schema.release.id, schema.check.releaseId))
      .innerJoin(schema.app, eq(schema.app.id, schema.release.appId))
      .where(
        and(
          eq(schema.app.publisherId, publisher.id),
          eq(schema.check.name, "impersonation"),
          ne(schema.check.status, "passed"),
        ),
      ),
    db
      .select({ name: schema.publisher.name, slug: schema.publisher.slug })
      .from(schema.publisher)
      .where(
        and(
          ne(schema.publisher.id, publisher.id),
          sql`lower(${schema.publisher.name}) = lower(${publisher.name})`,
        ),
      ),
    db
      .select({ name: schema.publisher.name, domains: schema.publisherVerification.domains })
      .from(schema.publisherVerification)
      .innerJoin(schema.publisher, eq(schema.publisher.id, schema.publisherVerification.publisherId))
      .where(
        and(
          ne(schema.publisher.id, publisher.id),
          inArray(schema.publisherVerification.status, ["approved", "open"]),
        ),
      ),
  ])
  const clash = verified.find((other) => other.domains.some((domain) => domains.includes(domain.name)))
  const flaggedApps = [...new Set(flagged.map((row) => row.app))]
  return [
    flaggedApps.length
      ? fact("Impersonation", "failed", `Flagged on ${flaggedApps.join(", ")}`)
      : fact("Impersonation", "passed", "No app of this publisher was flagged"),
    sameName.length
      ? fact("Name", "failed", `Also used by ${sameName.map((other) => other.slug).join(", ")}`)
      : fact("Name", "passed", "No other publisher has this name"),
    ...(clash ? [fact("Domains", "failed", `${clash.name} also asked to verify with these domains`)] : []),
  ]
}

export async function gatherFacts(publisher: PublisherRow, verification: VerificationRow) {
  const now = new Date()
  const domains = verification.domains.map((domain) => domain.name)
  const [registered, github, prefixes, apps, impersonation] = await Promise.all([
    Promise.all(domains.map(registeredAt)),
    verification.githubOrg ? githubOrganisation(verification.githubOrg, null) : null,
    provenNamespaces(publisher.id),
    appFacts(publisher.id),
    impersonationFacts(publisher, domains),
  ])
  return [
    ...domainFacts(verification.domains, registered, now),
    websiteFact(verification.website, domains),
    ...contactFacts(verification, domains),
    ...githubFact(verification, github?.createdAt ?? null, now),
    ...namespaceFacts(prefixes, domains),
    apps,
    ...impersonation,
  ]
}
