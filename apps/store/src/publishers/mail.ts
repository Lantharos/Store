import { env } from "cloudflare:workers"
import { ROLE_NAMES } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import type { Viewer } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { queueNotice } from "../mail/notices/send.ts"
import { invite as inviteMail } from "../mail/notices/templates/invite.ts"
import type { PublisherRow } from "./access.ts"

type InviteRow = typeof schema.invite.$inferSelect

export async function limitInvites(inviter: Viewer) {
  if (!(await env.INVITE_LIMIT.limit({ key: inviter.id })).success)
    fail(429, "Too many invitations at once; wait a minute")
}

async function recipientOf(invite: InviteRow) {
  if (invite.email) return invite.email
  const [user] = await db
    .select({ email: schema.user.email })
    .from(schema.account)
    .innerJoin(schema.user, eq(schema.user.id, schema.account.userId))
    .where(and(eq(schema.account.providerId, "github"), eq(schema.account.accountId, invite.githubId!)))
  return user?.email ?? null
}

export async function sendInvite(invite: InviteRow, publisher: PublisherRow, inviter: Viewer) {
  const to = await recipientOf(invite)
  if (!to) return
  queueNotice(
    to,
    inviteMail({
      inviter: { name: inviter.name, email: inviter.email },
      publisher: publisher.name,
      role: ROLE_NAMES[invite.role].label,
      githubLogin: invite.githubLogin,
      expires: invite.expiresAt,
    }),
  )
}
