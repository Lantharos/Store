import { type Account, AGREEMENT_VERSION } from "@schelf/protocol"
import { asc, desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars, Viewer } from "../../auth/session.ts"
import { avatarChoices, avatarUrl } from "../../avatars/urls.ts"
import { db, schema } from "../../db/client.ts"
import { pendingInvites } from "../../publishers/invites.ts"
import { publisherView } from "../../publishers/views.ts"
import { githubAccount } from "../access.ts"
import { avatarRoutes } from "./avatar.ts"

export const accountRoutes = new Hono<SignedInVars>()

accountRoutes.route("/avatar", avatarRoutes)

async function userWithGitHub(viewer: Viewer) {
  const user = (await db.query.user.findFirst({ where: eq(schema.user.id, viewer.id) }))!
  if (user.githubLogin && user.githubId) return user
  const github = await githubAccount(viewer.id)
  if (!github) return user
  const linked = { githubLogin: github.login, githubId: github.id }
  await db.update(schema.user).set(linked).where(eq(schema.user.id, viewer.id))
  return { ...user, ...linked }
}

accountRoutes.get("/", async (c) => {
  const viewer = c.var.viewer
  const [user, passkeys, memberships] = await Promise.all([
    userWithGitHub(viewer),
    db.$count(schema.passkey, eq(schema.passkey.userId, viewer.id)),
    db
      .select({ publisher: schema.publisher, role: schema.member.role })
      .from(schema.member)
      .innerJoin(schema.publisher, eq(schema.publisher.id, schema.member.publisherId))
      .where(eq(schema.member.userId, viewer.id))
      .orderBy(desc(schema.publisher.kind), asc(schema.publisher.name)),
  ])
  return c.json({
    user: { ...viewer, image: avatarUrl(user) },
    github: user.githubLogin,
    avatars: avatarChoices(user),
    passkeys,
    agreement: AGREEMENT_VERSION,
    publishers: memberships.map(({ publisher, role }) => publisherView(publisher, role)),
    invites: await pendingInvites(viewer, user.githubLogin),
  } satisfies Account)
})
