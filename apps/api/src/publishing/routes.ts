import { type ChecksResponse, checksReport, mirrorRequest, publishRequest } from "@schelf/protocol"
import { Hono } from "hono"
import { bearer, fail, readBody } from "../lib/http.ts"
import { acceptChecks, CHECKS_WORKFLOW, MIRROR_WORKFLOW, requireStoreWorkflow } from "../releases/checks.ts"
import { replaceMirror } from "../storefront/mirror.ts"
import { completeRelease } from "./complete.ts"
import { workflowClaims } from "./publisher.ts"
import { startRelease } from "./start.ts"
import { receiveFile } from "./upload.ts"
import { checkUploadToken } from "./upload-token.ts"

export const publishingRoutes = new Hono()

publishingRoutes.post("/publish", async (c) => {
  const body = await readBody(c, publishRequest)
  return c.json(await startRelease(bearer(c.req.raw), body), 201)
})

publishingRoutes.put("/publish/:release/files/:name", async (c) => {
  await checkUploadToken(bearer(c.req.raw), c.req.param("release"))
  return c.json(
    await receiveFile(c.req.param("release"), c.req.param("name"), c.req.raw, c.req.query("part")),
  )
})

publishingRoutes.post("/publish/:release/complete", async (c) => {
  await checkUploadToken(bearer(c.req.raw), c.req.param("release"))
  return c.json(await completeRelease(c.req.param("release")))
})

async function storeWorkflow(request: Request, workflow: string) {
  const token = bearer(request)
  if (!token) fail(401, "Call this with the workflow's GitHub identity token")
  requireStoreWorkflow(await workflowClaims(token), workflow)
}

publishingRoutes.post("/checks/:release", async (c) => {
  await storeWorkflow(c.req.raw, CHECKS_WORKFLOW)
  const report = await readBody(c, checksReport)
  return c.json({ status: await acceptChecks(c.req.param("release"), report) } satisfies ChecksResponse)
})

publishingRoutes.post("/mirror", async (c) => {
  await storeWorkflow(c.req.raw, MIRROR_WORKFLOW)
  return c.json(await replaceMirror(await readBody(c, mirrorRequest)))
})
