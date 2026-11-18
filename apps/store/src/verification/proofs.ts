import { type DomainProof, domainCovers } from "@schelf/protocol"
import { dnsHas, githubOwns, wellKnownHas } from "../dashboard/account/proofs.ts"
import { domainOf } from "../dashboard/views.ts"
import { maybeGithub } from "../github/api.ts"

const RDAP_TIMEOUT_MS = 5000

export function namespaceDomains(prefixes: string[]) {
  return prefixes.filter((prefix) => !prefix.startsWith("io.github.")).map(domainOf)
}

export async function proveDomain(
  domain: string,
  token: string,
  provenDomains: string[],
): Promise<DomainProof | null> {
  if (provenDomains.some((proven) => domainCovers(proven, domain))) return "namespace"
  if (await dnsHas(domain, token).catch(() => false)) return "dns"
  if (await wellKnownHas(domain, token).catch(() => false)) return "well-known"
  return null
}

interface RdapDomain {
  events?: { eventAction: string; eventDate: string }[]
}

export async function registeredAt(domain: string) {
  const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: "application/rdap+json" },
    signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
  }).catch(() => null)
  if (!response?.ok) return null
  const body = (await response.json().catch(() => null)) as RdapDomain | null
  const event = body?.events?.find((entry) => entry.eventAction === "registration")
  return event ? new Date(event.eventDate) : null
}

export async function githubOrganisation(org: string, account: { login: string; token: string } | null) {
  const [owns, profile] = await Promise.all([
    githubOwns(org, account),
    maybeGithub<{ login: string; type: string; created_at: string }>(`/users/${encodeURIComponent(org)}`),
  ])
  return { owns, login: profile?.login ?? org, createdAt: profile ? new Date(profile.created_at) : null }
}
