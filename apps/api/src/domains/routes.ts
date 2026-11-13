import { type CustomDomainState, setPublisherDomain } from "@schelf/protocol"
import { Hono } from "hono"
import type { SignedInVars } from "../auth/session.ts"
import { appSettings } from "../dashboard/apps/settings.ts"
import { fail, readBody } from "../lib/http.ts"
import { allow, appAccess, membership } from "../publishers/access.ts"
import { checkDomain } from "./check.ts"
import { domainOf, domainState, publisherDomainOf, settleDomain } from "./state.ts"

export const domainRoutes = new Hono<SignedInVars>()

domainRoutes.post("/:id/domain/check", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "apps")
  const row = await domainOf(app.id)
  if (!row) fail(404, "Set domain in schelf.toml and run schelf apply first")
  await checkDomain(row)
  return c.json(await appSettings(app))
})

export const publisherDomainRoutes = new Hono<SignedInVars>()

async function publisherFor(viewer: SignedInVars["Variables"]["viewer"], id: string) {
  const { publisher, role } = await membership(viewer.id, id)
  allow(role, "profile")
  return publisher
}

const stateOf = async (publisherId: string) => {
  const row = await publisherDomainOf(publisherId)
  return row ? domainState(row) : null
}

publisherDomainRoutes.get("/:id/domain", async (c) => {
  const { publisher } = await membership(c.var.viewer.id, c.req.param("id"))
  return c.json((await stateOf(publisher.id)) satisfies CustomDomainState | null)
})

publisherDomainRoutes.put("/:id/domain", async (c) => {
  const publisher = await publisherFor(c.var.viewer, c.req.param("id"))
  const { domain } = await readBody(c, setPublisherDomain)
  await settleDomain({ publisherId: publisher.id }, domain, c.var.viewer.name)
  return c.json(await stateOf(publisher.id))
})

publisherDomainRoutes.post("/:id/domain/check", async (c) => {
  const publisher = await publisherFor(c.var.viewer, c.req.param("id"))
  const row = await publisherDomainOf(publisher.id)
  if (!row) fail(404, "Connect a domain first")
  return c.json(domainState(await checkDomain(row)))
})
