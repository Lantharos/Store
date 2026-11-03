import { env, waitUntil } from "cloudflare:workers"
import { ROLE_NAMES } from "@schelf/protocol"
import { sql } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import type { PublisherRow } from "./access.ts"

type InviteRow = typeof schema.invite.$inferSelect

async function recipientOf(invite: InviteRow) {
  if (invite.email) return invite.email
  const user = await db.query.user.findFirst({
    where: sql`lower(${schema.user.githubLogin}) = ${invite.githubLogin}`,
  })
  return user?.email ?? null
}

export async function sendInvite(invite: InviteRow, publisher: PublisherRow, from: string) {
  const to = await recipientOf(invite)
  if (!to) return
  const role = ROLE_NAMES[invite.role].label.toLowerCase()
  waitUntil(
    env.EMAIL.send({
      from: env.NOTIFY_FROM,
      to,
      subject: `${from} invited you to ${publisher.name} on Schelf`,
      text: [
        `${from} invited you to publish apps as ${publisher.name} on schelf.store, as ${role === "admin" ? "an" : "a"} ${role}.`,
        `Sign in with this address${invite.githubLogin ? ` or with the GitHub account ${invite.githubLogin}` : ""} to join:`,
        `${env.PUBLIC_URL}/dashboard/invites`,
        "The invitation works for 14 days. If you weren't expecting it, you can ignore this email.",
      ].join("\n\n"),
    }),
  )
}
