import type { Mail } from "./parse.ts"

const ROUTING_SERVER = "mx.cloudflare.net"
const BULK_PRECEDENCE = ["bulk", "list", "junk"]
const MACHINE_SENDERS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/

export type Verdict = "reject" | "quarantine" | "unverified" | "verified" | "aligned"

type Headers = Mail["headers"]

function header(headers: Headers, key: string) {
  return headers.find((entry) => entry.key === key)?.value.trim()
}

function results(headers: Headers) {
  const value = headers.find(
    (entry) => entry.key === "authentication-results" && entry.value.trim().startsWith(ROUTING_SERVER),
  )?.value
  const outcomes = (method: string) =>
    [...(value ?? "").matchAll(new RegExp(`\\b${method}=(\\w+)`, "gi"))].map((match) =>
      match[1]!.toLowerCase(),
    )
  return { spf: outcomes("spf"), dkim: outcomes("dkim"), dmarc: outcomes("dmarc") }
}

export function verdictOf(headers: Headers): Verdict {
  const { spf, dkim, dmarc } = results(headers)
  if (dmarc.includes("fail")) return "reject"
  if (dmarc.includes("pass")) return "aligned"
  if (spf.includes("pass") || dkim.includes("pass")) return "verified"
  return spf.includes("fail") ? "quarantine" : "unverified"
}

export function isAutomated(headers: Headers, from: string) {
  const submitted = header(headers, "auto-submitted")?.toLowerCase()
  const precedence = header(headers, "precedence")?.toLowerCase()
  return (
    (!!submitted && submitted !== "no") ||
    !!header(headers, "list-id") ||
    !!header(headers, "list-unsubscribe") ||
    (!!precedence && BULK_PRECEDENCE.includes(precedence)) ||
    !!header(headers, "x-autoreply") ||
    !!header(headers, "x-autorespond") ||
    MACHINE_SENDERS.test(from)
  )
}
