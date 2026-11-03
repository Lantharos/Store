import { DEFAULT_LOCALE, type RestorableProject } from "@schelf/protocol"
import { and, desc, eq, isNull } from "drizzle-orm"
import type { Context } from "hono"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { deleteProject, purgeAt, restoreProject } from "../../hosting/deletion.ts"
import { fail } from "../../lib/http.ts"
import { active, allow, appAccess, type PublisherVars } from "../../publishers/access.ts"

export const deletingRoutes = new Hono<SignedInVars>()

deletingRoutes.delete("/:id", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "apps")
  return c.json(await deleteProject(app, c.var.viewer.name))
})

deletingRoutes.post("/:id/restore", async (c) => {
  const [row] = await db
    .select({ app: schema.app, publisher: schema.publisher, role: schema.member.role })
    .from(schema.app)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .innerJoin(
      schema.member,
      and(eq(schema.member.publisherId, schema.app.publisherId), eq(schema.member.userId, c.var.viewer.id)),
    )
    .where(and(eq(schema.app.id, c.req.param("id")), eq(schema.app.status, "deleted")))
  if (!row) fail(404, "There's no deleted project with that id")
  allow(row.role, "apps")
  active(row.publisher)
  await restoreProject(row.app, c.var.viewer.name)
  return c.body(null, 204)
})

export async function restorableProjects(c: Context<PublisherVars>) {
  allow(c.var.role, "apps")
  const rows = await db
    .select({ app: schema.app, name: schema.listing.name })
    .from(schema.app)
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(
      and(
        eq(schema.app.publisherId, c.var.publisher.id),
        eq(schema.app.status, "deleted"),
        isNull(schema.app.purgedAt),
      ),
    )
    .orderBy(desc(schema.app.deletedAt))
  return c.json(
    rows.map(({ app, name }) => ({
      id: app.id,
      name: name ?? app.slug,
      kind: app.kind,
      deleted_at: app.deletedAt!.toISOString(),
      restorable_until: purgeAt(app.deletedAt!).toISOString(),
    })) satisfies RestorableProject[],
  )
}
