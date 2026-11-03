import { type Account, AGREEMENT_VERSION, becomeDeveloper } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { fail, readBody } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { githubAccount } from "../access.ts"
import { developerView } from "../views.ts"

export const accountRoutes = new Hono<SignedInVars>()

function slugFor(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

accountRoutes.get("/", async (c) => {
  const viewer = c.var.viewer
  const [developer, passkeys] = await Promise.all([
    db.query.developer.findFirst({ where: eq(schema.developer.userId, viewer.id) }),
    db.$count(schema.passkey, eq(schema.passkey.userId, viewer.id)),
  ])
  const github = developer?.githubLogin ?? (await githubAccount(viewer.id))?.login ?? null
  return c.json({
    user: viewer,
    developer: developer ? developerView(developer) : null,
    github,
    passkeys,
    agreement: { current: AGREEMENT_VERSION, accepted: developer?.agreementVersion ?? null },
  } satisfies Account)
})

accountRoutes.post("/developer", async (c) => {
  const input = await readBody(c, becomeDeveloper)
  const viewer = c.var.viewer
  const existing = await db.query.developer.findFirst({ where: eq(schema.developer.userId, viewer.id) })
  const now = new Date()
  if (existing) {
    await db
      .update(schema.developer)
      .set({ name: input.name, kind: input.kind, agreementVersion: input.agreement, agreementAt: now })
      .where(eq(schema.developer.id, existing.id))
    return c.json(
      developerView({ ...existing, name: input.name, kind: input.kind, agreementVersion: input.agreement }),
    )
  }
  const base = slugFor(input.name) || "developer"
  const taken = await db.query.developer.findFirst({ where: eq(schema.developer.slug, base) })
  const github = await githubAccount(viewer.id)
  const developer = {
    id: randomId(),
    userId: viewer.id,
    name: input.name,
    slug: taken ? `${base}-${randomId(4)}` : base,
    kind: input.kind,
    githubLogin: github?.login ?? null,
    agreementVersion: input.agreement,
    agreementAt: now,
    status: "active" as const,
    createdAt: now,
  }
  await db.insert(schema.developer).values(developer)
  return c.json(developerView(developer), 201)
})

accountRoutes.post("/github", async (c) => {
  const developer = await db.query.developer.findFirst({
    where: eq(schema.developer.userId, c.var.viewer.id),
  })
  if (!developer) fail(403, "Accept the developer agreement first")
  const github = await githubAccount(c.var.viewer.id)
  if (!github) fail(409, "Connect your GitHub account first")
  await db
    .update(schema.developer)
    .set({ githubLogin: github.login })
    .where(eq(schema.developer.id, developer.id))
  return c.json(developerView({ ...developer, githubLogin: github.login }))
})
