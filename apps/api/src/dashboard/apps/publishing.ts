import {
  addTrustedPublisher,
  type CreatedToken,
  createToken,
  sha256Hex,
  TOKEN_PREFIX,
  type TrustedPublisher,
} from "@schelf/protocol"
import { and, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import type { DeveloperVars } from "../../auth/session.ts"
import { db, schema } from "../../db/client.ts"
import { repository } from "../../github/api.ts"
import { fail, readBody } from "../../lib/http.ts"
import { randomId } from "../../lib/ids.ts"
import { DAY_MS } from "../../lib/time.ts"
import { githubAccount, ownedApp } from "../access.ts"

const TOKEN_DAYS = 365
const TOKEN_BYTES = 32

export const publishingRoutes = new Hono<DeveloperVars>()

publishingRoutes.post("/:id/publishers", async (c) => {
  const app = await ownedApp(c.var.developer, c.req.param("id"))
  const input = await readBody(c, addTrustedPublisher)
  const account = await githubAccount(c.var.viewer.id)
  const repo = await repository(input.repository, account?.token)
  if (!repo) fail(422, `GitHub has no repository ${input.repository} that you can see`)
  const row = {
    id: randomId(),
    appId: app.id,
    ownerId: String(repo.owner.id),
    repositoryId: String(repo.id),
    repository: repo.full_name,
    workflow: input.workflow,
    environment: input.environment ?? null,
    createdAt: new Date(),
  }
  await db.insert(schema.trustedPublisher).values(row)
  return c.json(
    {
      id: row.id,
      owner_id: row.ownerId,
      repository_id: row.repositoryId,
      repository: row.repository,
      workflow: row.workflow,
      environment: row.environment,
      created_at: row.createdAt.toISOString(),
    } satisfies TrustedPublisher,
    201,
  )
})

publishingRoutes.delete("/:id/publishers/:publisher", async (c) => {
  const app = await ownedApp(c.var.developer, c.req.param("id"))
  await db
    .delete(schema.trustedPublisher)
    .where(
      and(
        eq(schema.trustedPublisher.id, c.req.param("publisher")),
        eq(schema.trustedPublisher.appId, app.id),
      ),
    )
  return c.body(null, 204)
})

publishingRoutes.post("/:id/tokens", async (c) => {
  const app = await ownedApp(c.var.developer, c.req.param("id"))
  const { name } = await readBody(c, createToken)
  const token = `${TOKEN_PREFIX}${randomId(TOKEN_BYTES)}`
  const now = new Date()
  const row = {
    id: randomId(),
    appId: app.id,
    developerId: c.var.developer.id,
    hash: await sha256Hex(token),
    name,
    expiresAt: new Date(now.getTime() + TOKEN_DAYS * DAY_MS),
    createdAt: now,
  }
  await db.insert(schema.token).values(row)
  return c.json(
    {
      id: row.id,
      name,
      token,
      last_used_at: null,
      expires_at: row.expiresAt.toISOString(),
      revoked_at: null,
    } satisfies CreatedToken,
    201,
  )
})

publishingRoutes.delete("/:id/tokens/:token", async (c) => {
  const app = await ownedApp(c.var.developer, c.req.param("id"))
  await db
    .update(schema.token)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.token.id, c.req.param("token")),
        eq(schema.token.appId, app.id),
        isNull(schema.token.revokedAt),
      ),
    )
  return c.body(null, 204)
})
