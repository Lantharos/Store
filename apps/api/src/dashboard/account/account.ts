import { type Account, AGREEMENT_VERSION } from "@schelf/protocol"
import { asc, desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars, Viewer } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { pendingInvites } from "../../publishers/invites.ts"
import { publisherView } from "../../publishers/views.ts"
import { githubAccount } from "../access.ts"

export const accountRoutes = new Hono<SignedInVars>()

async function githubLoginOf(viewer: Viewer) {
  const user = await db.query.user.findFirst({ where: eq(schema.user.id, viewer.id) })
  if (user?.githubLogin) return user.githubLogin
  const github = await githubAccount(viewer.id)
  if (github)
    await db.update(schema.user).set({ githubLogin: github.login }).where(eq(schema.user.id, viewer.id))
  return github?.login ?? null
}

accountRoutes.get("/", async (c) => {
  const viewer = c.var.viewer
  const [github, passkeys, memberships] = await Promise.all([
    githubLoginOf(viewer),
    db.$count(schema.passkey, eq(schema.passkey.userId, viewer.id)),
    db
      .select({ publisher: schema.publisher, role: schema.member.role })
      .from(schema.member)
      .innerJoin(schema.publisher, eq(schema.publisher.id, schema.member.publisherId))
      .where(eq(schema.member.userId, viewer.id))
      .orderBy(desc(schema.publisher.kind), asc(schema.publisher.name)),
  ])
  return c.json({
    user: viewer,
    github,
    passkeys,
    agreement: AGREEMENT_VERSION,
    publishers: memberships.map(({ publisher, role }) => publisherView(publisher, role)),
    invites: await pendingInvites(viewer, github),
  } satisfies Account)
})
