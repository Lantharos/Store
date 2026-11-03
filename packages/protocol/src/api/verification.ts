import { z } from "zod"
import { githubLogin } from "./publishers.ts"

export const VERIFICATION_STATUSES = [
  "draft",
  "open",
  "more-requested",
  "approved",
  "rejected",
  "revoked",
] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]
export const DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_DOCUMENTS = 5
export const MAX_DOMAINS = 5

export type DomainProof = "dns" | "well-known" | "namespace"

export interface VerificationDomain {
  name: string
  proof: DomainProof | null
  checked_at: string | null
}

export const VERIFICATION_EVENTS = [
  "submitted",
  "checked",
  "more-requested",
  "replied",
  "message",
  "approved",
  "rejected",
  "revoked",
] as const
export type VerificationEventKind = (typeof VERIFICATION_EVENTS)[number]

export interface VerificationCheck {
  label: string
  passed: boolean
}

export interface VerificationEvent {
  kind: VerificationEventKind
  by: string | null
  text: string | null
  checks: VerificationCheck[] | null
  at: string
}

export interface VerificationDocument {
  id: string
  name: string
  size: number
}

export interface Verification {
  id: string
  status: VerificationStatus
  legal_name: string
  website: string | null
  domains: VerificationDomain[]
  proof_token: string
  contact_email: string | null
  contact_confirmed: boolean
  github_org: string | null
  github_org_proven: boolean
  note: string
  documents: VerificationDocument[]
  history: VerificationEvent[]
  reason: string | null
  submitted_at: string | null
  decided_at: string | null
}

export interface VerificationState {
  verified: boolean
  current: Verification | null
}

export const domainName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "That isn't a domain")

export const saveVerification = z.object({
  legal_name: z.string().trim().max(200).optional(),
  website: z
    .url({ protocol: /^https$/ })
    .nullable()
    .optional(),
  domains: z.array(domainName).max(MAX_DOMAINS).optional(),
  contact_email: z.email().trim().toLowerCase().nullable().optional(),
  github_org: githubLogin.nullable().optional(),
  note: z.string().trim().max(2000).optional(),
})
export type SaveVerification = z.input<typeof saveVerification>

export const confirmContact = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "The code is six digits"),
})
export const verificationReply = z.object({ text: z.string().trim().min(1).max(5000) })

export function domainCovers(domain: string, host: string) {
  return host === domain || host.endsWith(`.${domain}`)
}
