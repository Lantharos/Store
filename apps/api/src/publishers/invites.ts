import type { DashboardPublisher, PendingInvite } from "@schelf/protocol"
import { and, eq, gt, or, type SQL } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars, Viewer } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { mediaUrl } from "../signing/records.ts"
import { publisherView } from "./views.ts"

export const inviteRoutes = new Hono<SignedInVars>()

function addressedTo(viewer: Viewer, github: string | null) {
  const byEmail = eq(schema.invite.email, viewer.email.toLowerCase())
  return github ? or(byEmail, eq(schema.invite.githubLogin, github.toLowerCase())) : byEmail
}

function invitesFor(viewer: Viewer, github: string | null, only?: SQL) {
  return db
    .select({ invite: schema.invite, publisher: schema.publisher, by: schema.user.name })
    .from(schema.invite)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.invite.publisherId))
    .leftJoin(schema.user, eq(schema.user.id, schema.invite.invitedBy))
    .where(and(addressedTo(viewer, github), gt(schema.invite.expiresAt, new Date()), only))
}

export async function pendingInvites(viewer: Viewer, github: string | null): Promise<PendingInvite[]> {
  const rows = await invitesFor(viewer, github)
  return rows.map(({ invite, publisher, by }) => ({
    id: invite.id,
    publisher: { name: publisher.name, slug: publisher.slug, logo: mediaUrl(publisher.logoKey) },
    role: invite.role,
    invited_by: by,
    expires_at: invite.expiresAt.toISOString(),
  }))
}

async function viewersInvite(viewer: Viewer, id: string) {
  const user = await db.query.user.findFirst({ where: eq(schema.user.id, viewer.id) })
  const [row] = await invitesFor(viewer, user?.githubLogin ?? null, eq(schema.invite.id, id))
  if (!row) fail(404, "That invitation isn't for you, or it expired")
  return row
}

inviteRoutes.post("/:invite/accept", async (c) => {
  const { invite, publisher } = await viewersInvite(c.var.viewer, c.req.param("invite"))
  await db.batch([
    db
      .insert(schema.member)
      .values({ publisherId: publisher.id, userId: c.var.viewer.id, role: invite.role })
      .onConflictDoNothing(),
    db.delete(schema.invite).where(eq(schema.invite.id, invite.id)),
  ])
  return c.json(publisherView(publisher, invite.role) satisfies DashboardPublisher)
})

inviteRoutes.post("/:invite/decline", async (c) => {
  const { invite } = await viewersInvite(c.var.viewer, c.req.param("invite"))
  await db.delete(schema.invite).where(eq(schema.invite.id, invite.id))
  return c.body(null, 204)
})
