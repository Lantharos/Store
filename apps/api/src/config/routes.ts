import { applyRequest, splitProjectPath } from "@schelf/protocol"
import { Hono } from "hono"
import { fail, readBody } from "../lib/http.ts"
import { appById, appByProject } from "../publishing/start.ts"
import { applyFiles } from "./apply.ts"
import { callerOf } from "./caller.ts"
import { receiveMedia } from "./media.ts"

export const configRoutes = new Hono()

configRoutes.post("/apply", async (c) => c.json(await applyFiles(c.req.raw, await readBody(c, applyRequest))))

configRoutes.put("/apply/media/:sha256", async (c) => {
  const name = c.req.query("app") ?? ""
  const path = splitProjectPath(name)
  const app = path ? await appByProject(path.publisher, path.project) : await appById(name)
  if (!app) fail(404, `${name} isn't on schelf.store`)
  await callerOf(c.req.raw, app)
  return c.json(await receiveMedia(app, c.req.param("sha256"), c.req.raw), 201)
})
