import { githubLogin } from "@schelf/protocol"
import { Hono } from "hono"
import { fail } from "../lib/http.ts"

const EDGE = 160
const DAY_SECONDS = 24 * 60 * 60
const CACHE = `public, max-age=${DAY_SECONDS}, stale-while-revalidate=${7 * DAY_SECONDS}`

export const avatarRoutes = new Hono()

avatarRoutes.get("/github/:who", async (c) => {
  const who = githubLogin.safeParse(c.req.param("who"))
  if (!who.success) fail(404, "Not found")
  const path = /^\d+$/.test(who.data) ? `u/${who.data}` : who.data
  const upstream = await fetch(`https://avatars.githubusercontent.com/${path}?s=${EDGE}`, {
    cf: { cacheEverything: true, cacheTtl: DAY_SECONDS },
  })
  const type = upstream.headers.get("content-type") ?? ""
  if (!upstream.ok || !type.startsWith("image/")) fail(404, "Not found")
  return new Response(upstream.body, {
    headers: { "content-type": type, "cache-control": CACHE, "x-content-type-options": "nosniff" },
  })
})
