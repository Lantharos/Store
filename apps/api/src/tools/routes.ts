import { claimToolName, isReservedToolName, type PublisherTool, toolsOf } from "@schelf/protocol"
import { and, eq, ne } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { fail, readBody } from "../lib/http.ts"
import { allow, membership, type PublisherRow } from "../publishers/access.ts"
import { resignApp } from "../signing/queue.ts"
import { englishListing, within } from "../signing/records.ts"
import { findTool, projectTool, shortNames, shortState } from "./registry.ts"

export const toolRoutes = new Hono<SignedInVars>()

async function publisherTools(publisher: PublisherRow): Promise<PublisherTool[]> {
  const apps = await db
    .select()
    .from(schema.app)
    .where(and(eq(schema.app.publisherId, publisher.id), ne(schema.app.status, "deleted")))
  const owned = apps.flatMap((app) => toolsOf(app).map((entry) => ({ app, entry })))
  const listings = owned.length
    ? await db
        .select()
        .from(schema.listing)
        .where(
          within(
            schema.listing.appId,
            owned.map(({ app }) => app.id),
          ),
        )
    : []
  const rows = await shortNames(owned.map(({ entry }) => entry.name))
  const owner = { id: publisher.id, slug: publisher.slug, verified: publisher.verifiedAt !== null }
  return owned.map(({ app, entry }) => ({
    ...projectTool(entry, publisher.slug, shortState(entry.name, owner, rows.get(entry.name))),
    project: `${publisher.slug}/${app.slug}`,
    project_name: englishListing({ app, listing: listings.filter((row) => row.appId === app.id) }).name,
  }))
}

toolRoutes.get("/:id/tools", async (c) => {
  const { publisher } = await membership(c.var.viewer.id, c.req.param("id"))
  return c.json((await publisherTools(publisher)) satisfies PublisherTool[])
})

toolRoutes.post("/:id/tool-names", async (c) => {
  const { publisher, role } = await membership(c.var.viewer.id, c.req.param("id"))
  allow(role, "apps")
  const { name } = await readBody(c, claimToolName)
  if (!publisher.verifiedAt) fail(403, "Short names are for verified publishers")
  if (isReservedToolName(name, publisher.slug))
    fail(409, `${name} is kept for the system and well-known tools`)
  const found = await findTool(publisher.slug, name)
  if (!found) fail(404, `None of ${publisher.name}'s projects installs ${name}; add tool = "${name}" first`)
  const [claimed] = await db
    .insert(schema.toolName)
    .values({ name, publisherId: publisher.id, claimedBy: c.var.viewer.name })
    .onConflictDoNothing()
    .returning()
  if (!claimed) fail(409, `${name} is taken`)
  await resignApp(found.app.id)
  return c.json((await publisherTools(publisher)) satisfies PublisherTool[], 201)
})
