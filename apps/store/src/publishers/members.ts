import {
  changeRole as changeRoleBody,
  INVITE_DAYS,
  inviteMember,
  type Members,
  type SentInvite,
} from "@schelf/protocol"
import { and, asc, eq, gt } from "drizzle-orm"
import { Hono } from "hono"
import { avatarUrl, githubAvatar } from "../avatars/urls.ts"
import { db, schema } from "../db/client.ts"
import { githubUser } from "../github/api.ts"
import { fail, readBody } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { DAY_MS } from "../lib/time.ts"
import { allow, type PublisherVars } from "./access.ts"
import { limitInvites, sendInvite } from "./mail.ts"
import { changeRole, removeMember, transferOwnership } from "./ownership.ts"

export const memberRoutes = new Hono<PublisherVars>()

const actor = (c: { var: PublisherVars["Variables"] }) => ({ id: c.var.viewer.id, role: c.var.role })

memberRoutes.get("/members", async (c) => {
  const publisher = c.var.publisher.id
  const [members, invites] = await Promise.all([
    db
      .select({ member: schema.member, user: schema.user })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .where(eq(schema.member.publisherId, publisher))
      .orderBy(asc(schema.member.createdAt)),
    db
      .select({ invite: schema.invite, by: schema.user.name })
      .from(schema.invite)
      .leftJoin(schema.user, eq(schema.user.id, schema.invite.invitedBy))
      .where(and(eq(schema.invite.publisherId, publisher), gt(schema.invite.expiresAt, new Date())))
      .orderBy(asc(schema.invite.createdAt)),
  ])
  return c.json({
    members: members.map(({ member, user }) => ({
      user_id: user.id,
      name: user.name,
      email: user.email,
      image: avatarUrl(user),
      role: member.role,
      joined_at: member.createdAt.toISOString(),
    })),
    invites: invites.map(({ invite, by }) => inviteView(invite, by)),
  } satisfies Members)
})

function inviteView(invite: typeof schema.invite.$inferSelect, by: string | null): SentInvite {
  return {
    id: invite.id,
    email: invite.email,
    github: invite.githubLogin,
    avatar: invite.githubLogin ? githubAvatar(invite.githubLogin) : null,
    role: invite.role,
    invited_by: by,
    expires_at: invite.expiresAt.toISOString(),
  }
}

type Invitee = { email: string } | { githubLogin: string; githubId: string }

async function invitee(input: { email: string } | { github: string }): Promise<Invitee> {
  if ("email" in input) return { email: input.email }
  const account = await githubUser(input.github)
  if (!account) fail(422, `GitHub has no account ${input.github}`)
  return { githubLogin: account.login.toLowerCase(), githubId: String(account.id) }
}

async function alreadyMember(publisherId: string, to: Invitee) {
  const query = db
    .select({ id: schema.user.id })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
  const [row] = await ("email" in to
    ? query.where(and(eq(schema.member.publisherId, publisherId), eq(schema.user.email, to.email)))
    : query
        .innerJoin(schema.account, eq(schema.account.userId, schema.user.id))
        .where(
          and(
            eq(schema.member.publisherId, publisherId),
            eq(schema.account.providerId, "github"),
            eq(schema.account.accountId, to.githubId),
          ),
        )
  ).limit(1)
  return row !== undefined
}

memberRoutes.post("/invites", async (c) => {
  const publisher = c.var.publisher
  if (publisher.kind === "person") fail(409, "Create an organisation to work with others")
  allow(c.var.role, "members")
  const input = await readBody(c, inviteMember)
  if (input.role === "owner") allow(c.var.role, "owners")
  const to = await invitee(input)
  if (await alreadyMember(publisher.id, to)) fail(409, "They're already a member")
  await limitInvites(c.var.viewer)
  const now = new Date()
  const row = {
    id: randomId(),
    publisherId: publisher.id,
    email: "email" in to ? to.email : null,
    githubLogin: "githubId" in to ? to.githubLogin : null,
    githubId: "githubId" in to ? to.githubId : null,
    role: input.role,
    invitedBy: c.var.viewer.id,
    expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY_MS),
    createdAt: now,
  }
  const same = "email" in to ? eq(schema.invite.email, to.email) : eq(schema.invite.githubId, to.githubId)
  await db.batch([
    db.delete(schema.invite).where(and(eq(schema.invite.publisherId, publisher.id), same)),
    db.insert(schema.invite).values(row),
  ])
  await sendInvite(row, publisher, c.var.viewer)
  return c.json(inviteView(row, c.var.viewer.name), 201)
})

memberRoutes.delete("/invites/:invite", async (c) => {
  allow(c.var.role, "members")
  await db
    .delete(schema.invite)
    .where(
      and(eq(schema.invite.id, c.req.param("invite")), eq(schema.invite.publisherId, c.var.publisher.id)),
    )
  return c.body(null, 204)
})

memberRoutes.patch("/members/:user", async (c) => {
  const { role } = await readBody(c, changeRoleBody)
  await changeRole(c.var.publisher, actor(c), c.req.param("user"), role)
  return c.body(null, 204)
})

memberRoutes.delete("/members/:user", async (c) => {
  await removeMember(c.var.publisher, actor(c), c.req.param("user"))
  return c.body(null, 204)
})

memberRoutes.post("/members/:user/transfer", async (c) => {
  await transferOwnership(c.var.publisher, actor(c), c.req.param("user"))
  return c.body(null, 204)
})
