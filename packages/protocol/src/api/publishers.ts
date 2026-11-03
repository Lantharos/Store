import { z } from "zod"
import { RESERVED_SLUGS } from "../projects.ts"

export const AGREEMENT_VERSION = "2026-11"
export const PUBLISHER_KINDS = ["person", "organisation"] as const
export type PublisherKind = (typeof PUBLISHER_KINDS)[number]
export const ROLES = ["owner", "admin", "developer"] as const
export const role = z.enum(ROLES)
export type Role = z.infer<typeof role>
export const MAX_LOGO_BYTES = 1024 * 1024
export const LOGO_EDGE = { min: 128, max: 2048 } as const
export const INVITE_DAYS = 14
export const AVATAR_SOURCES = ["github", "upload"] as const
export type AvatarSource = (typeof AVATAR_SOURCES)[number]
export const chooseAvatar = z.object({ avatar: z.enum(AVATAR_SOURCES) })

const ABILITIES = {
  owner: ["releases", "apps", "members", "profile", "owners", "verification"],
  admin: ["releases", "apps", "members", "profile"],
  developer: ["releases"],
} as const satisfies Record<Role, readonly string[]>
export type Ability = (typeof ABILITIES)["owner"][number]

export function can(role: Role, ability: Ability) {
  return (ABILITIES[role] as readonly Ability[]).includes(ability)
}

export const ROLE_NAMES: Record<Role, { label: string; about: string }> = {
  owner: { label: "Owner", about: "Everything, including owners and verification" },
  admin: { label: "Admin", about: "Apps, publishing, members and the public page" },
  developer: { label: "Developer", about: "Releases and listings" },
}

export interface DashboardPublisher {
  id: string
  kind: PublisherKind
  name: string
  slug: string
  description: string
  website: string | null
  logo: string | null
  verified: boolean
  status: "active" | "suspended"
  agreement_version: string
  role: Role
}

export interface PendingInvite {
  id: string
  publisher: { name: string; slug: string; logo: string | null }
  role: Role
  invited_by: string | null
  expires_at: string
}

export interface Account {
  user: { id: string; name: string; email: string; image: string | null }
  github: string | null
  avatars: { using: AvatarSource; github: string | null; upload: string | null }
  passkeys: number
  agreement: string
  publishers: DashboardPublisher[]
  invites: PendingInvite[]
}

const publisherName = z.string().trim().min(1).max(80)
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
  .min(2)
  .max(40)
  .refine((value) => !RESERVED_SLUGS.has(value), "That address is reserved")

export const createPublisher = z.object({
  kind: z.enum(PUBLISHER_KINDS),
  name: publisherName,
  agreement: z.literal(AGREEMENT_VERSION),
})
export type CreatePublisher = z.infer<typeof createPublisher>

export const updatePublisher = z.object({
  name: publisherName.optional(),
  slug: slug.optional(),
  description: z.string().trim().max(240).optional(),
  website: z
    .url({ protocol: /^https$/ })
    .nullable()
    .optional(),
  agreement: z.literal(AGREEMENT_VERSION).optional(),
})
export type UpdatePublisher = z.input<typeof updatePublisher>

export interface Member {
  user_id: string
  name: string
  email: string
  image: string | null
  role: Role
  joined_at: string
}

export interface SentInvite {
  id: string
  email: string | null
  github: string | null
  avatar: string | null
  role: Role
  invited_by: string | null
  expires_at: string
}

export interface Members {
  members: Member[]
  invites: SentInvite[]
}

export const githubLogin = z
  .string()
  .trim()
  .regex(/^@?[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/, "That isn't a GitHub username")
  .transform((login) => login.replace(/^@/, ""))

export const inviteMember = z.union([
  z.object({ email: z.email().trim().toLowerCase(), role }),
  z.object({ github: githubLogin, role }),
])
export type InviteMember = z.input<typeof inviteMember>

export const changeRole = z.object({ role })
