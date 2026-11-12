import {
  endChannelRequest,
  isProjectId,
  manualUpload,
  promoteRelease,
  RESERVED_SLUGS,
  schelfTomlFor,
  startSwitch as startSwitchRequest,
  updateChannel,
  updateHosting,
} from "@schelf/protocol"
import { and, eq, ne } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { refuseIfListingInFiles, refuseIfSetInFiles } from "../../config/managed.ts"
import { db, schema } from "../../db/client.ts"
import { ensureChannel, promote } from "../../hosting/channels.ts"
import { endChannel, reopenChannel } from "../../hosting/ended.ts"
import { requestListing } from "../../hosting/listing.ts"
import { cancelSwitch, latestSwitch, startSwitch } from "../../hosting/switches.ts"
import { fail, readBody } from "../../lib/http.ts"
import { recordHistory } from "../../ops/events.ts"
import { appAccess, releaseAccess } from "../../publishers/access.ts"
import { createRelease, publishable } from "../../publishing/start.ts"
import { resignApp } from "../../signing/queue.ts"
import { appSettings } from "./settings.ts"

export const hostingRoutes = new Hono<SignedInVars>()

hostingRoutes.patch("/:id/hosting", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "apps")
  const input = await readBody(c, updateHosting)
  if (input.page_indexed !== undefined) refuseIfListingInFiles(app)
  if (input.latest_follows_rollout !== undefined) refuseIfSetInFiles(app)
  if (input.slug && input.slug !== app.slug) {
    if (RESERVED_SLUGS.has(input.slug)) fail(422, "That name is reserved")
    const taken = await db.$count(
      schema.app,
      and(
        eq(schema.app.publisherId, app.publisherId),
        eq(schema.app.slug, input.slug),
        ne(schema.app.id, app.id),
      ),
    )
    if (taken) fail(409, "Another project of yours has that address")
  }
  await db
    .update(schema.app)
    .set({
      slug: input.slug,
      pageIndexed: input.page_indexed,
      latestFollowsRollout: input.latest_follows_rollout,
    })
    .where(eq(schema.app.id, app.id))
  if (input.slug && input.slug !== app.slug)
    recordHistory("app", app.id, `Moved its address to ${input.slug}`, c.var.viewer.name)
  const updated = (await db.query.app.findFirst({ where: eq(schema.app.id, app.id) }))!
  await resignApp(app.id)
  return c.json(await appSettings(updated))
})

hostingRoutes.post("/:id/listing-request", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "apps")
  await requestListing(app, c.var.viewer.name)
  return c.json(await appSettings((await appAccess(c.var.viewer, app.id)).app))
})

hostingRoutes.post("/:id/switch", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "apps")
  refuseIfSetInFiles(app)
  const { to } = await readBody(c, startSwitchRequest)
  await startSwitch(app, to, c.var.viewer.name)
  return c.json(await appSettings((await appAccess(c.var.viewer, app.id)).app))
})

hostingRoutes.delete("/:id/switch", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "apps")
  refuseIfSetInFiles(app)
  await cancelSwitch(app, c.var.viewer.name)
  return c.json(await appSettings((await appAccess(c.var.viewer, app.id)).app))
})

hostingRoutes.patch("/:id/channels/:channel", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfSetInFiles(app)
  const changes = await readBody(c, updateChannel)
  const name = c.req.param("channel")
  await ensureChannel(app.id, name)
  await db
    .update(schema.channel)
    .set(changes)
    .where(and(eq(schema.channel.appId, app.id), eq(schema.channel.name, name)))
  return c.json(await appSettings(app))
})

hostingRoutes.post("/:id/channels/:channel/end", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfSetInFiles(app)
  const { into } = await readBody(c, endChannelRequest)
  await endChannel(app, c.req.param("channel"), into, c.var.viewer.name)
  return c.json(await appSettings(app))
})

hostingRoutes.post("/:id/channels/:channel/reopen", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  refuseIfSetInFiles(app)
  await reopenChannel(app, c.req.param("channel"), c.var.viewer.name)
  return c.json(await appSettings(app))
})

hostingRoutes.post("/:id/releases/:release/promote", async (c) => {
  const { release } = await releaseAccess(c.var.viewer, c.req.param("id"), c.req.param("release"), "releases")
  const { channel } = await readBody(c, promoteRelease)
  return c.json({ release: await promote(release, channel, c.var.viewer.name) }, 201)
})

hostingRoutes.post("/:id/uploads", async (c) => {
  const { app } = await appAccess(c.var.viewer, c.req.param("id"), "releases")
  if (app.kind === "extension")
    fail(422, "Extensions publish with schelf publish, which sends their extension.toml")
  const input = await readBody(c, manualUpload)
  await publishable(app)
  const owner = (await db.query.publisher.findFirst({ where: eq(schema.publisher.id, app.publisherId) }))!
  const move = input.bridge ? await latestSwitch(app.id) : null
  const format = move?.fromFormat ?? app.format
  return c.json(
    await createRelease({
      app,
      publisher: { origin: "manual", tokenId: null },
      version: input.version.replace(/^v/, ""),
      commit: null,
      notes: input.notes,
      manifest: schelfTomlFor({
        id: app.id,
        project: isProjectId(app.id) ? `${owner.slug}/${app.slug}` : undefined,
        kind: app.kind,
        format,
      }),
      format,
      declared: { permissions: null, extensionAccess: null, luftMinimum: null },
      requires: {},
      channel: input.channel,
      bridge: input.bridge,
      files: input.files,
    }),
    201,
  )
})
