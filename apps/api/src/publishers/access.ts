import { type Ability, can, type Role } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { createMiddleware } from "hono/factory"
import type { Viewer } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"

export type PublisherRow = typeof schema.publisher.$inferSelect
export type Membership = { publisher: PublisherRow; role: Role }
export type PublisherVars = { Variables: { viewer: Viewer } & Membership }

const REFUSALS: Record<Ability, string> = {
  releases: "You can't change releases or listings here",
  apps: "Only owners and admins can do that",
  members: "Only owners and admins manage members",
  profile: "Only owners and admins change the public page",
  owners: "Only owners can do that",
  verification: "Only owners can ask for verification",
}

export async function membership(userId: string, publisherId: string): Promise<Membership> {
  const [row] = await db
    .select({ publisher: schema.publisher, role: schema.member.role })
    .from(schema.member)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.member.publisherId))
    .where(and(eq(schema.member.userId, userId), eq(schema.member.publisherId, publisherId)))
  if (!row) fail(404, "You aren't a member of that publisher")
  return row
}

export function allow(role: Role, ability: Ability) {
  if (!can(role, ability)) fail(403, REFUSALS[ability])
}

export function active(publisher: PublisherRow) {
  if (publisher.status === "suspended") fail(403, `${publisher.name} is suspended`)
}

export const asMember = createMiddleware<PublisherVars>(async (c, next) => {
  const { publisher, role } = await membership(c.var.viewer.id, c.req.param("publisher")!)
  c.set("publisher", publisher)
  c.set("role", role)
  await next()
})

export async function appAccess(viewer: Viewer, id: string, ability?: Ability) {
  const [row] = await db
    .select({ app: schema.app, publisher: schema.publisher, role: schema.member.role })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .innerJoin(
      schema.member,
      and(eq(schema.member.publisherId, schema.app.publisherId), eq(schema.member.userId, viewer.id)),
    )
    .where(eq(schema.app.id, id))
  if (!row) fail(404, "You don't have an app with that id")
  if (ability) {
    allow(row.role, ability)
    active(row.publisher)
  }
  return row
}

export async function releaseAccess(viewer: Viewer, appId: string, releaseId: string, ability?: Ability) {
  const { app } = await appAccess(viewer, appId, ability)
  const release = await db.query.release.findFirst({
    where: and(eq(schema.release.id, releaseId), eq(schema.release.appId, app.id)),
  })
  if (!release) fail(404, "That release doesn't exist")
  return { app, release }
}
