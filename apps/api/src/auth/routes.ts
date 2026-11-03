import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { fail } from "../lib/http.ts"
import { auth } from "./auth.ts"

export const authRoutes = new Hono()

authRoutes.on(["GET", "POST"], "/*", async (c) => {
  if (c.req.method === "POST") {
    const ip = c.req.header("cf-connecting-ip") ?? "local"
    if (!(await env.AUTH_LIMIT.limit({ key: ip })).success)
      fail(429, "Too many attempts, try again in a minute")
  }
  return auth.handler(c.req.raw)
})
