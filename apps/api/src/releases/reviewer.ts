import { env } from "cloudflare:workers"
import { paths } from "@schelf/protocol"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { equalStrings } from "../lib/hmac.ts"
import { bearer, fail, readBody } from "../lib/http.ts"
import { releases } from "../ops/data/records.ts"
import { fileUrl } from "../signing/records.ts"
import { approve, reject, requestChanges } from "./review.ts"

const REVIEWER = "reviewer"

const decision = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), security: z.boolean().default(false) }),
  z.object({ action: z.literal("request-changes"), reason: z.string().trim().min(1).max(5000) }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(1).max(2000) }),
])

const reviewer = createMiddleware(async (c, next) => {
  const token = bearer(c.req.raw)
  if (!env.REVIEWER_TOKEN || !token || !equalStrings(token, env.REVIEWER_TOKEN)) fail(401, "Reviewers only")
  await next()
})

export const reviewerRoutes = new Hono()

reviewerRoutes.use("*", reviewer)

reviewerRoutes.get("/:release", async (c) => {
  const release = await releases.byId(c.req.param("release"))
  if (!release) fail(404, "That release doesn't exist")
  const [checks, artifacts] = await Promise.all([releases.checks(release.id), releases.artifacts(release.id)])
  return c.json({
    release,
    checks,
    artifacts: artifacts.map((artifact) => ({ ...artifact, url: fileUrl(artifact.key) })),
    facts: fileUrl(paths.check(release.appId, release.version, "facts")),
  })
})

reviewerRoutes.post("/:release/decision", async (c) => {
  const input = await readBody(c, decision)
  const id = c.req.param("release")
  const message =
    input.action === "approve"
      ? await approve(id, REVIEWER, { security: input.security })
      : input.action === "request-changes"
        ? await requestChanges(id, REVIEWER, input.reason)
        : await reject(id, REVIEWER, input.reason)
  return c.json({ message })
})
