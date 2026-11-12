import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { bearer, fail } from "../lib/http.ts"
import { auth } from "./auth.ts"
import { inBrowser, viewerOf } from "./session.ts"

const FROM_THE_COMMAND = new Set(["/api/auth/get-session", "/api/auth/sign-out"])

export const authRoutes = new Hono()

authRoutes.on(["GET", "POST"], "/*", async (c) => {
  if (c.req.method === "POST") {
    const ip = c.req.header("cf-connecting-ip") ?? "local"
    if (!(await env.AUTH_LIMIT.limit({ key: ip })).success)
      fail(429, "Too many attempts, try again in a minute")
  }
  if (bearer(c.req.raw) && !FROM_THE_COMMAND.has(c.req.path)) {
    const found = await viewerOf(c.req.raw.headers)
    if (found && !inBrowser(found.signed))
      fail(403, "The schelf command can't change your account; do that in the dashboard")
  }
  return auth.handler(c.req.raw)
})
