import { createMiddleware } from "hono/factory"
import { fail } from "../lib/http.ts"
import { auth } from "./auth.ts"

export type Viewer = { id: string; name: string; email: string; image: string | null }
export type SignedInVars = { Variables: { viewer: Viewer } }

export const signedIn = createMiddleware<SignedInVars>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) fail(401, "Sign in first")
  c.set("viewer", { ...session.user, image: session.user.image ?? null })
  await next()
})
