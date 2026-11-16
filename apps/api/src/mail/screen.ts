import type { Mail } from "./parse.ts"

const ROUTING_SERVER = "mx.cloudflare.net"
const BULK_PRECEDENCE = ["bulk", "list", "junk"]
const MACHINE_SENDERS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/
const RESULT = /^([a-z0-9-]+)(?:\/\d+)?\s*=\s*([a-z]+)/i

export type Verdict = "reject" | "quarantine" | "unverified" | "verified" | "aligned"

type Headers = Mail["headers"]

function header(headers: Headers, key: string) {
  return headers.find((entry) => entry.key === key)?.value.trim()
}

function clauses(value: string) {
  const found: string[] = []
  let current = ""
  let quoted = false
  let nesting = 0
  for (let at = 0; at < value.length; at++) {
    const char = value[at]!
    if (char === "\\" && (quoted || nesting)) {
      if (quoted) current += char + (value[at + 1] ?? "")
      at++
    } else if (quoted) {
      current += char
      quoted = char !== '"'
    } else if (nesting) nesting += char === "(" ? 1 : char === ")" ? -1 : 0
    else if (char === "(") nesting = 1
    else if (char === ";") {
      found.push(current.trim())
      current = ""
    } else {
      current += char
      quoted = char === '"'
    }
  }
  return [...found, current.trim()]
}

function results(headers: Headers) {
  const resinfo =
    headers
      .filter((entry) => entry.key === "authentication-results")
      .map((entry) => clauses(entry.value))
      .find(([server]) => server?.split(/\s+/)[0]?.toLowerCase() === ROUTING_SERVER)
      ?.slice(1) ?? []
  const outcomes = (method: string) =>
    resinfo.flatMap((clause) => {
      const [, name, result] = RESULT.exec(clause) ?? []
      return name?.toLowerCase() === method ? [result!.toLowerCase()] : []
    })
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
