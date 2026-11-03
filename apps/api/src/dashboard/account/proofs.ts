import type { ProofMethod } from "@schelf/protocol"
import { maybeGithub } from "../../github/api.ts"
import { domainOf } from "../views.ts"

const TIMEOUT_MS = 5000

interface DnsAnswer {
  Answer?: { type: number; data: string }[]
}

const TXT = 16

async function dnsHas(domain: string, token: string) {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`,
    {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  )
  if (!response.ok) return false
  const answer = (await response.json()) as DnsAnswer
  return (answer.Answer ?? []).some(
    (record) =>
      record.type === TXT &&
      record.data.replace(/"\s*"/g, "").replace(/"/g, "").trim() === `schelf-verify=${token}`,
  )
}

async function wellKnownHas(domain: string, token: string) {
  const response = await fetch(`https://${domain}/.well-known/schelf-store.txt`, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null)
  return response?.ok === true && (await response.text()).includes(token)
}

export function githubOwnerOf(prefix: string) {
  const [io, github, owner, ...rest] = prefix.split(".")
  return io === "io" && github === "github" && owner && rest.length === 0 ? owner : null
}

async function githubOwns(owner: string, account: { login: string; token: string } | null) {
  if (!account) return false
  if (account.login.toLowerCase() === owner.toLowerCase()) return true
  const membership = await maybeGithub<{ role: string; state: string }>(`/user/memberships/orgs/${owner}`, {
    token: account.token,
  })
  return membership?.state === "active" && membership.role === "admin"
}

export async function proves(
  method: ProofMethod,
  prefix: string,
  token: string,
  account: () => Promise<{ login: string; token: string } | null>,
) {
  const owner = githubOwnerOf(prefix)
  if (method === "github") return owner !== null && githubOwns(owner, await account())
  if (owner) return false
  const domain = domainOf(prefix)
  return method === "dns" ? dnsHas(domain, token) : wellKnownHas(domain, token)
}
