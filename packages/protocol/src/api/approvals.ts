import { z } from "zod"
import { customDomain } from "../domains.ts"
import { projectSlug } from "../projects.ts"
import { channelName } from "../releases.ts"
import {
  addTrustedPublisher,
  claimNamespace,
  createApp,
  createChannelToken,
  createProject,
  createToken,
  inviteToChannel,
  verifyNamespace,
} from "./dashboard.ts"
import { githubLogin, PUBLISHER_KINDS, role, slug } from "./publishers.ts"

export const NEW_PUBLISHER = "@new"
export const APPROVAL_MINUTES = 30
export const PASSKEY_MINUTES = 5

const publisher = z
  .string()
  .min(1)
  .max(64)
  .describe(`A publisher id, or ${NEW_PUBLISHER} for one made earlier in the request`)
const app = z.string().min(1).max(255)
const id = z.string().min(1).max(64)

export const approvalAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("publisher.create"),
    kind: z.enum(PUBLISHER_KINDS),
    name: z.string().trim().min(1).max(80),
  }),
  z.object({
    type: z.literal("publisher.rename"),
    publisher,
    name: z.string().trim().min(1).max(80).optional(),
    slug: slug.optional(),
  }),
  z.object({ type: z.literal("namespace.claim"), publisher, prefix: claimNamespace.shape.prefix }),
  z.object({ type: z.literal("publisher.domain"), publisher, domain: customDomain.nullable() }),
  z.object({
    type: z.literal("namespace.verify"),
    publisher,
    prefix: claimNamespace.shape.prefix,
    method: verifyNamespace.shape.method,
  }),
  z.object({ type: z.literal("namespace.release"), publisher, prefix: claimNamespace.shape.prefix }),
  z.object({ type: z.literal("app.create"), publisher, app: createApp }),
  z.object({ type: z.literal("project.create"), publisher, project: createProject }),
  z.object({ type: z.literal("project.rename"), app, slug: projectSlug.min(1) }),
  z.object({ type: z.literal("project.delete"), app }),
  z.object({ type: z.literal("project.restore"), app }),
  z.object({ type: z.literal("listing.request"), app, note: z.string().trim().max(1000).default("") }),
  z.object({ type: z.literal("trust.add"), app, rule: addTrustedPublisher }),
  z.object({ type: z.literal("trust.remove"), app, rule: id }),
  z.object({ type: z.literal("token.create"), app, name: createToken.shape.name }),
  z.object({
    type: z.literal("channel.invite"),
    app,
    channel: channelName,
    email: inviteToChannel.shape.email,
  }),
  z.object({
    type: z.literal("channel.token"),
    app,
    channel: channelName,
    name: createChannelToken.shape.name,
  }),
  z.object({
    type: z.literal("member.invite"),
    publisher,
    to: z.union([z.object({ email: z.email().trim().toLowerCase() }), z.object({ github: githubLogin })]),
    role,
  }),
  z.object({ type: z.literal("member.role"), publisher, user: id, role }),
  z.object({ type: z.literal("member.remove"), publisher, user: id }),
  z.object({ type: z.literal("member.transfer"), publisher, user: id }),
  z.object({ type: z.literal("invite.accept"), invite: id }),
  z.object({ type: z.literal("release.rollback"), app, release: id }),
  z.object({ type: z.literal("release.inside-luft"), app, release: id }),
])
export type ApprovalAction = z.input<typeof approvalAction>
export type ApprovalType = ApprovalAction["type"]

export const PASSKEY_ACTIONS: ReadonlySet<ApprovalType> = new Set([
  "project.delete",
  "trust.add",
  "trust.remove",
  "token.create",
  "member.role",
  "member.transfer",
])

export const createApproval = z.object({
  actions: z.array(approvalAction).min(1).max(10),
  host: z.string().trim().max(100).optional(),
})
export type CreateApproval = z.input<typeof createApproval>

export const APPROVAL_STATUSES = ["pending", "done", "failed", "cancelled", "expired"] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export interface ApprovalStep {
  type: ApprovalType
  summary: string
  outcome: "done" | "failed" | null
  detail: string | null
}

export interface Approval {
  id: string
  url: string
  status: ApprovalStatus
  steps: ApprovalStep[]
  passkey: boolean
  requested_by: string
  host: string | null
  place: string | null
  created_at: string
  expires_at: string
  decided_at: string | null
  secrets: Record<string, string>
}
