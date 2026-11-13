import { Hono } from "hono"
import type { SignedInVars } from "../auth/session.ts"
import { appSettings } from "../dashboard/apps/settings.ts"
import { fail } from "../lib/http.ts"
import { appAccess } from "../publishers/access.ts"
import { checkDomain } from "./check.ts"
import { domainOf } from "./state.ts"

export const domainRoutes = new Hono<SignedInVars>()

domainRoutes.post("/:id/domain/check", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "apps")
  const row = await domainOf(app.id)
  if (!row) fail(404, "Set domain in schelf.toml and run schelf apply first")
  await checkDomain(row)
  return c.json(await appSettings(app))
})
