import { createMiddleware } from "hono/factory"
import { fail } from "../lib/http.ts"
import { auth, type Via } from "./auth.ts"

export type Viewer = { id: string; name: string; email: string; image: string | null }
export type Signed = { via: Via | null; since: Date }
export type SignedInVars = { Variables: { viewer: Viewer; signed: Signed } }

export async function viewerOf(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) return null
  return {
    viewer: { ...session.user, image: session.user.image ?? null } satisfies Viewer,
    signed: { via: (session.session.via ?? null) as Via | null, since: new Date(session.session.createdAt) },
  }
}

export const inBrowser = (signed: Signed) => signed.via === "browser" || signed.via === "passkey"

export const signedIn = createMiddleware<SignedInVars>(async (c, next) => {
  const found = await viewerOf(c.req.raw.headers)
  if (!found) fail(401, "Sign in first")
  c.set("viewer", found.viewer)
  c.set("signed", found.signed)
  await next()
})
