import { ROLE_NAMES } from "@schelf/protocol"
import { sql } from "drizzle-orm"
import type { Viewer } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { queueNotice } from "../mail/notices/send.ts"
import { invite as inviteMail } from "../mail/notices/templates/invite.ts"
import type { PublisherRow } from "./access.ts"

type InviteRow = typeof schema.invite.$inferSelect

async function recipientOf(invite: InviteRow) {
  if (invite.email) return invite.email
  const user = await db.query.user.findFirst({
    where: sql`lower(${schema.user.githubLogin}) = ${invite.githubLogin}`,
  })
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
