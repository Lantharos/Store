import { claimNamespace, type Namespace, verifyNamespace } from "@schelf/protocol"
import { and, eq, isNotNull, lt, ne, sql } from "drizzle-orm"
import { Hono } from "hono"
import { db, schema } from "../../db/client.ts"
import { fail, readBody } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { DAY_MS } from "../../lib/time.ts"
import { active, allow, type PublisherVars } from "../../publishers/access.ts"
import { githubAccount } from "../access.ts"
import { namespaceView } from "../views.ts"
import { githubOwnerOf, proves } from "./proofs.ts"

const RECHECK_DAYS = 30
const RECHECKS_PER_RUN = 50

export const namespaceRoutes = new Hono<PublisherVars>()

namespaceRoutes.get("/", async (c) => {
  const rows = await db
    .select()
    .from(schema.namespace)
    .where(eq(schema.namespace.publisherId, c.var.publisher.id))
  return c.json(rows.map(namespaceView) satisfies Namespace[])
})

namespaceRoutes.post("/", async (c) => {
  allow(c.var.role, "apps")
  active(c.var.publisher)
  const { prefix } = await readBody(c, claimNamespace)
  if (prefix.startsWith("io.github.") && !githubOwnerOf(prefix))
    fail(422, "A GitHub namespace is io.github.<user or organisation>")
  const existing = await db.query.namespace.findFirst({ where: eq(schema.namespace.prefix, prefix) })
  if (existing?.publisherId === c.var.publisher.id) return c.json(namespaceView(existing))
  if (existing?.proof) fail(409, `${prefix} belongs to another publisher; open a claim if it's yours`)
  const row = {
    prefix,
    publisherId: c.var.publisher.id,
    proof: null,
    proofValue: randomId(24),
    verifiedAt: null,
    checkedAt: null,
    createdAt: new Date(),
  }
  await db
    .insert(schema.namespace)
    .values(row)
    .onConflictDoUpdate({
      target: schema.namespace.prefix,
      set: { publisherId: row.publisherId, proofValue: row.proofValue },
    })
  return c.json(namespaceView(row), 201)
})

namespaceRoutes.post("/:prefix/verify", async (c) => {
  allow(c.var.role, "apps")
  active(c.var.publisher)
  const { method } = await readBody(c, verifyNamespace)
  const row = await db.query.namespace.findFirst({
    where: and(
      eq(schema.namespace.prefix, c.req.param("prefix")),
      eq(schema.namespace.publisherId, c.var.publisher.id),
    ),
  })
  if (!row) fail(404, "Claim the namespace first")
  if (!(await proves(method, row.prefix, row.proofValue, () => githubAccount(c.var.viewer.id))))
    fail(
      422,
      method === "github"
        ? "Sign in with the GitHub account that owns it, or as an owner of the organisation"
        : "The proof isn't there yet; DNS changes can take a few minutes",
    )
  const now = new Date()
  const verified = { ...row, proof: method, verifiedAt: now, checkedAt: now }
  await db
    .update(schema.namespace)
    .set({ proof: method, verifiedAt: now, checkedAt: now })
    .where(eq(schema.namespace.prefix, row.prefix))
  return c.json(namespaceView(verified))
})

namespaceRoutes.delete("/:prefix", async (c) => {
  allow(c.var.role, "apps")
  active(c.var.publisher)
  const prefix = c.req.param("prefix")
  const used = await db.$count(
    schema.app,
    and(
      eq(schema.app.publisherId, c.var.publisher.id),
      sql`lower(${schema.app.id}) like ${`${prefix.toLowerCase()}.%`}`,
    ),
  )
  if (used) fail(409, "An app still uses this namespace")
  await db
    .delete(schema.namespace)
    .where(and(eq(schema.namespace.prefix, prefix), eq(schema.namespace.publisherId, c.var.publisher.id)))
  return c.body(null, 204)
})

export async function recheckNamespaces(now = new Date()) {
  const due = await db
    .select({ namespace: schema.namespace, userId: schema.publisher.ownerId })
    .from(schema.namespace)
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.namespace.publisherId))
    .where(
      and(
        isNotNull(schema.namespace.proof),
        ne(schema.namespace.proof, "manual"),
        lt(schema.namespace.checkedAt, new Date(now.getTime() - RECHECK_DAYS * DAY_MS)),
      ),
    )
    .limit(RECHECKS_PER_RUN)
  for (const { namespace, userId } of due) {
    const holds = await proves(namespace.proof as "dns", namespace.prefix, namespace.proofValue, () =>
      githubAccount(userId),
    ).catch(() => false)
    await db
      .update(schema.namespace)
      .set(
        holds
          ? { checkedAt: now, verifiedAt: namespace.verifiedAt ?? now }
          : { checkedAt: now, verifiedAt: null },
      )
      .where(eq(schema.namespace.prefix, namespace.prefix))
  }
}
