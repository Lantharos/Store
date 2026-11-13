import { z } from "zod"

export const customDomain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){2,}[a-z]{2,63}$/,
    "A domain under one you own, like downloads.example.com",
  )
  .refine((name) => !/(^|\.)schelf\.store$/.test(name), "Use a domain of your own")

export const DOMAIN_STATUSES = ["proving", "connecting", "active", "paused"] as const
export type DomainStatus = (typeof DOMAIN_STATUSES)[number]

export const DOMAIN_TARGET = "domains.schelf.store"
export const domainProofName = (domain: string) => `_schelf.${domain}`

export interface DomainRecord {
  type: "TXT" | "CNAME"
  name: string
  value: string
}

export interface CustomDomainState {
  domain: string
  status: DomainStatus
  records: DomainRecord[]
  /** Why it isn't serving yet, in words, when it isn't. */
  waiting: string | null
  checked_at: string | null
}

export const setPublisherDomain = z.object({ domain: customDomain.nullable() })
