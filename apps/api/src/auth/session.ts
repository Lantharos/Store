import { eq } from "drizzle-orm"
import { createMiddleware } from "hono/factory"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { auth } from "./auth.ts"

export type Viewer = { id: string; name: string; email: string; image: string | null }
export type Developer = typeof schema.developer.$inferSelect
export type SignedInVars = { Variables: { viewer: Viewer } }
export type DeveloperVars = { Variables: { viewer: Viewer; developer: Developer } }

export const signedIn = createMiddleware<SignedInVars>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) fail(401, "Sign in first")
  c.set("viewer", { ...session.user, image: session.user.image ?? null })
  await next()
})

export const asDeveloper = createMiddleware<DeveloperVars>(async (c, next) => {
  const developer = await db.query.developer.findFirst({
    where: eq(schema.developer.userId, c.var.viewer.id),
  })
  if (!developer) fail(403, "Accept the developer agreement first")
  if (developer.status === "suspended") fail(403, "This developer account is suspended")
  c.set("developer", developer)
  await next()
})
