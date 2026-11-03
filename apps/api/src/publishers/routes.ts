import {
  createPublisher,
  type DashboardPublisher,
  LOGO_EDGE,
  MAX_LOGO_BYTES,
  paths,
  updatePublisher,
} from "@schelf/protocol"
import { and, eq, ne } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../auth/session.ts"
import { namespaceRoutes } from "../dashboard/account/namespaces.ts"
import { publisherAppRoutes } from "../dashboard/apps/apps.ts"
import { storeImage } from "../dashboard/apps/media.ts"
import { db, schema } from "../db/client.ts"
import { fail, readBody } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { resignPublisher } from "../signing/queue.ts"
import { reindexApp } from "../storefront/indexing.ts"
import { verificationRoutes } from "../verification/routes.ts"
import { allow, asMember, type PublisherVars } from "./access.ts"
import { memberRoutes } from "./members.ts"
import { publisherView, slugFor } from "./views.ts"

export const publisherRoutes = new Hono<SignedInVars>()
const scoped = new Hono<PublisherVars>()

async function freeSlug(base: string) {
  const taken = await db.query.publisher.findFirst({ where: eq(schema.publisher.slug, base) })
  return taken ? `${base}-${randomId(4)}` : base
}

publisherRoutes.post("/", async (c) => {
  const input = await readBody(c, createPublisher)
  const viewer = c.var.viewer
  if (input.kind === "person") {
    const own = await db.query.publisher.findFirst({
      where: and(eq(schema.publisher.ownerId, viewer.id), eq(schema.publisher.kind, "person")),
    })
    if (own) fail(409, "You already publish as yourself")
  }
  const now = new Date()
  const row = {
    id: randomId(),
    kind: input.kind,
    ownerId: viewer.id,
    name: input.name,
    slug: await freeSlug(slugFor(input.name) || "publisher"),
    description: "",
    website: null,
    logoKey: null,
    agreementVersion: input.agreement,
    agreementAt: now,
    status: "active" as const,
    verifiedAt: null,
    createdAt: now,
  }
  await db.batch([
    db.insert(schema.publisher).values(row),
    db
      .insert(schema.member)
      .values({ publisherId: row.id, userId: viewer.id, role: "owner", createdAt: now }),
  ])
  return c.json(publisherView(row, "owner") satisfies DashboardPublisher, 201)
})

scoped.use("*", asMember)

scoped.get("/", (c) => c.json(publisherView(c.var.publisher, c.var.role) satisfies DashboardPublisher))

scoped.patch("/", async (c) => {
  const { agreement, ...profile } = await readBody(c, updatePublisher)
  const publisher = c.var.publisher
  if (Object.keys(profile).length) allow(c.var.role, "profile")
  if (agreement) allow(c.var.role, "owners")
  if (profile.slug && profile.slug !== publisher.slug) {
    const taken = await db.query.publisher.findFirst({
      where: and(eq(schema.publisher.slug, profile.slug), ne(schema.publisher.id, publisher.id)),
    })
    if (taken) fail(409, `schelf.store/publishers/${profile.slug} is taken`)
  }
  const changes = {
    ...profile,
    ...(agreement && { agreementVersion: agreement, agreementAt: new Date() }),
  }
  await db.update(schema.publisher).set(changes).where(eq(schema.publisher.id, publisher.id))
  if (
    (profile.name && profile.name !== publisher.name) ||
    (profile.slug && profile.slug !== publisher.slug)
  ) {
    const apps = await resignPublisher(publisher.id)
    await Promise.all(apps.map(reindexApp))
  }
  return c.json(publisherView({ ...publisher, ...changes }, c.var.role) satisfies DashboardPublisher)
})

scoped.put("/logo", async (c) => {
  allow(c.var.role, "profile")
  const publisher = c.var.publisher
  const { key, image } = await storeImage(
    c.req.raw,
    (hash, extension) => paths.publisherLogo(publisher.id, hash, extension),
    MAX_LOGO_BYTES,
    true,
  )
  if (image.width !== image.height) fail(422, "Logos are square")
  if (image.width < LOGO_EDGE.min || image.width > LOGO_EDGE.max)
    fail(422, `Logos are between ${LOGO_EDGE.min} and ${LOGO_EDGE.max} pixels wide`)
  await db.update(schema.publisher).set({ logoKey: key }).where(eq(schema.publisher.id, publisher.id))
  return c.json(publisherView({ ...publisher, logoKey: key }, c.var.role) satisfies DashboardPublisher)
})

scoped.route("/", memberRoutes)
scoped.route("/namespaces", namespaceRoutes)
scoped.route("/apps", publisherAppRoutes)
scoped.route("/verification", verificationRoutes)

publisherRoutes.route("/:publisher", scoped)
