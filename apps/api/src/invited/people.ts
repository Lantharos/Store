import {
  DEFAULT_LOCALE,
  type InvitedChannel,
  type InvitedDownloads,
  offeredReleases,
  paths,
} from "@schelf/protocol"
import { and, eq, inArray, or, sql } from "drizzle-orm"
import { Hono } from "hono"
import { auth } from "../auth/auth.ts"
import { db, schema } from "../db/client.ts"
import { linkBase, pageUrl } from "../hosting/addresses.ts"
import { channelRoute } from "../hosting/ended.ts"
import { latestFiles } from "../hosting/files.ts"
import { linkReleases } from "../hosting/releases.ts"
import { fail } from "../lib/http.ts"
import { partPlan } from "../publishing/parts.ts"
import { appByProject } from "../publishing/start.ts"
import { fileUrl } from "../signing/records.ts"
import { personOpens } from "./access.ts"
import { signReleases } from "./links.ts"

const LINK_MINUTES = 60
const PAGE_LINKS = { followRollout: false, draw: 0 }
const SHOWN = ["published", "delisted"] as const

export const invitedRoutes = new Hono()

async function person(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) fail(401, "Sign in to see what you're invited to")
  return session.user
}

invitedRoutes.get("/invited", async (c) => {
  const user = await person(c.req.raw)
  const memberships = db
    .select({ publisherId: schema.member.publisherId })
    .from(schema.member)
    .where(eq(schema.member.userId, user.id))
  const invites = db
    .select({ appId: schema.channelInvite.appId, channel: schema.channelInvite.channel })
    .from(schema.channelInvite)
    .where(eq(schema.channelInvite.email, sql`lower(${user.email})`))
  const rows = await db
    .select({
      app: schema.app,
      channel: schema.channel.name,
      publisher: schema.publisher.slug,
      name: schema.listing.name,
    })
    .from(schema.channel)
    .innerJoin(schema.app, eq(schema.app.id, schema.channel.appId))
    .innerJoin(schema.publisher, eq(schema.publisher.id, schema.app.publisherId))
    .leftJoin(
      schema.listing,
      and(eq(schema.listing.appId, schema.app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    )
    .where(
      and(
        eq(schema.channel.inviteOnly, true),
        inArray(schema.app.status, [...SHOWN]),
        or(
          inArray(schema.app.publisherId, memberships),
          user.emailVerified ? sql`(${schema.channel.appId}, ${schema.channel.name}) in ${invites}` : sql`0`,
        ),
      ),
    )
  return c.json(
    rows.map(
      ({ app, channel, publisher, name }): InvitedChannel => ({
        app: app.id,
        project: `${publisher}/${app.slug}`,
        name: name ?? app.slug,
        channel,
        page: pageUrl(app, publisher),
        index: fileUrl(paths.invitedApp(app.id, channel)),
        sabine: app.updater === "sabine" ? fileUrl(paths.invitedSabine(app.id, channel)) : null,
        latest: `${linkBase(app, publisher, channel)}/latest`,
      }),
    ),
    200,
    { "cache-control": "private, no-store" },
  )
})

invitedRoutes.get("/invited/projects/:publisher/:project", async (c) => {
  const user = await person(c.req.raw)
  const app = await appByProject(c.req.param("publisher"), c.req.param("project"))
  if (!app || !(SHOWN as readonly string[]).includes(app.status)) fail(404, "There's no project here")
  const [channels, listing] = await Promise.all([
    db
      .select({ name: schema.channel.name })
      .from(schema.channel)
      .where(and(eq(schema.channel.appId, app.id), eq(schema.channel.inviteOnly, true))),
    db.query.listing.findFirst({
      where: and(eq(schema.listing.appId, app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    }),
  ])
  const open = []
  for (const { name } of channels) if (await personOpens(user, app, [name])) open.push(name)
  const expires = new Date(Date.now() + LINK_MINUTES * 60_000).toISOString()
  const downloads = await Promise.all(
    open.map(async (channel): Promise<InvitedDownloads | null> => {
      const releases = offeredReleases(
        await signReleases(await linkReleases(app.id, await channelRoute(app.id, channel))),
        partPlan(app),
      )
      const newest = releases.find((release) => release.channel === channel) ?? releases[0]
      if (!newest) return null
      return {
        project: `${c.req.param("publisher")}/${app.slug}`,
        name: listing?.name ?? app.slug,
        channel,
        version: newest.version,
        published: newest.published,
        notes: newest.notes,
        page: pageUrl(app, c.req.param("publisher")),
        files: latestFiles(linkBase(app, c.req.param("publisher"), channel), releases, PAGE_LINKS),
        expires,
      }
    }),
  )
  return c.json(
    downloads.filter((entry) => entry !== null),
    200,
    { "cache-control": "private, no-store" },
  )
})
