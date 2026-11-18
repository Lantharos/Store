import { eq } from "drizzle-orm"
import { createMiddleware } from "hono/factory"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { APP_SESSION_MS, auth, type Via } from "./auth.ts"

const RENEW_EVERY_MS = 24 * 3_600_000

/** Keeps the Schelf app's session APP_SESSION_DAYS from its last use, at most once a day. */
export async function renewAppSession(session: {
  id: string
  via?: string | null
  expiresAt: Date | string
}) {
  const renewed = Date.now() + APP_SESSION_MS
  if (session.via !== "app" || renewed - new Date(session.expiresAt).getTime() < RENEW_EVERY_MS) return
  await db
    .update(schema.session)
    .set({ expiresAt: new Date(renewed) })
    .where(eq(schema.session.id, session.id))
}

export type Viewer = { id: string; name: string; email: string; image: string | null }
export type Signed = { via: Via | null; since: Date }
export type SignedInVars = { Variables: { viewer: Viewer; signed: Signed } }

export async function viewerOf(headers: Headers, uncached = false) {
  const session = await auth.api.getSession({ headers, query: { disableCookieCache: uncached } })
  if (!session) return null
  await renewAppSession(session.session)
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
