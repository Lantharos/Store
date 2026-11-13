import {
  CHANNEL_TOKEN_PREFIX,
  type ChannelAccess,
  type CreatedChannelToken,
  createChannelToken,
  DEFAULT_LOCALE,
  inviteToChannel,
  sha256Hex,
} from "@schelf/protocol"
import { and, desc, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { pageUrl } from "../hosting/addresses.ts"
import { fail, readBody } from "../lib/http.ts"
import { randomId } from "../lib/ids.ts"
import { iso } from "../lib/time.ts"
import { queueNotice } from "../mail/notices/send.ts"
import { channelInvite } from "../mail/notices/templates/channel.ts"
import { recordHistory } from "../ops/events.ts"
import { appAccess } from "../publishers/access.ts"
import type { AppRow } from "../signing/records.ts"

const TOKEN_BYTES = 32

export const channelAccessRoutes = new Hono<SignedInVars>()

async function inviteOnly(viewer: SignedInVars["Variables"]["viewer"], id: string, channel: string) {
  const { app } = await appAccess(viewer, id, "apps")
  const row = await db.query.channel.findFirst({
    where: and(eq(schema.channel.appId, app.id), eq(schema.channel.name, channel)),
  })
  if (!row?.inviteOnly) fail(404, `${channel} isn't invite-only; set invite_only in schelf.toml first`)
  return app
}

async function accessOf(appId: string, channel: string): Promise<ChannelAccess> {
  const where = (table: typeof schema.channelInvite | typeof schema.channelToken) =>
    and(eq(table.appId, appId), eq(table.channel, channel))
  const [invites, tokens] = await Promise.all([
    db
      .select({ invite: schema.channelInvite, by: schema.user.name })
      .from(schema.channelInvite)
      .leftJoin(schema.user, eq(schema.user.id, schema.channelInvite.invitedBy))
      .where(where(schema.channelInvite))
      .orderBy(desc(schema.channelInvite.createdAt)),
    db
      .select()
      .from(schema.channelToken)
      .where(where(schema.channelToken))
      .orderBy(desc(schema.channelToken.createdAt)),
  ])
  return {
    channel,
    invites: invites.map(({ invite, by }) => ({
      id: invite.id,
      email: invite.email,
      invited_by: by ?? "",
      created_at: invite.createdAt.toISOString(),
    })),
    tokens: tokens.map((token) => ({
      id: token.id,
      name: token.name,
      created_at: token.createdAt.toISOString(),
      last_used_at: iso(token.lastUsedAt),
      revoked_at: iso(token.revokedAt),
    })),
  }
}

async function tellInvited(
  app: AppRow,
  channel: string,
  email: string,
  inviter: { name: string; email: string },
) {
  const [owner, listing] = await Promise.all([
    db.query.publisher.findFirst({ where: eq(schema.publisher.id, app.publisherId) }),
    db.query.listing.findFirst({
      where: and(eq(schema.listing.appId, app.id), eq(schema.listing.locale, DEFAULT_LOCALE)),
    }),
  ])
  queueNotice(
    email,
    channelInvite({ inviter, app: listing?.name ?? app.slug, channel, page: pageUrl(app, owner!.slug) }),
  )
}

channelAccessRoutes.get("/:id/channels/:channel/access", async (c) => {
  const app = await inviteOnly(c.var.viewer, c.req.param("id"), c.req.param("channel"))
  return c.json(await accessOf(app.id, c.req.param("channel")))
})

channelAccessRoutes.post("/:id/channels/:channel/invites", async (c) => {
  const channel = c.req.param("channel")
  const app = await inviteOnly(c.var.viewer, c.req.param("id"), channel)
  const { email } = await readBody(c, inviteToChannel)
  const [added] = await db
    .insert(schema.channelInvite)
    .values({ id: randomId(), appId: app.id, channel, email, invitedBy: c.var.viewer.id })
    .onConflictDoNothing()
    .returning()
  if (added) {
    await tellInvited(app, channel, email, c.var.viewer)
    recordHistory("app", app.id, `Invited someone to ${channel}`, c.var.viewer.name)
  }
  return c.json(await accessOf(app.id, channel), added ? 201 : 200)
})

channelAccessRoutes.delete("/:id/channels/:channel/invites/:invite", async (c) => {
  const channel = c.req.param("channel")
  const app = await inviteOnly(c.var.viewer, c.req.param("id"), channel)
  const [removed] = await db
    .delete(schema.channelInvite)
    .where(
      and(
        eq(schema.channelInvite.id, c.req.param("invite")),
        eq(schema.channelInvite.appId, app.id),
        eq(schema.channelInvite.channel, channel),
      ),
    )
    .returning({ id: schema.channelInvite.id })
  if (removed) recordHistory("app", app.id, `Took back an invitation to ${channel}`, c.var.viewer.name)
  return c.json(await accessOf(app.id, channel))
})

channelAccessRoutes.post("/:id/channels/:channel/tokens", async (c) => {
  const channel = c.req.param("channel")
  const app = await inviteOnly(c.var.viewer, c.req.param("id"), channel)
  const { name } = await readBody(c, createChannelToken)
  const token = `${CHANNEL_TOKEN_PREFIX}${randomId(TOKEN_BYTES)}`
  const row = {
    id: randomId(),
    appId: app.id,
    channel,
    name,
    hash: await sha256Hex(token),
    createdAt: new Date(),
  }
  await db.insert(schema.channelToken).values(row)
  recordHistory("app", app.id, `Made the download token ${name} for ${channel}`, c.var.viewer.name)
  return c.json(
    {
      id: row.id,
      name,
      token,
      created_at: row.createdAt.toISOString(),
      last_used_at: null,
      revoked_at: null,
    } satisfies CreatedChannelToken,
    201,
  )
})

channelAccessRoutes.delete("/:id/channels/:channel/tokens/:token", async (c) => {
  const channel = c.req.param("channel")
  const app = await inviteOnly(c.var.viewer, c.req.param("id"), channel)
  const [revoked] = await db
    .update(schema.channelToken)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.channelToken.id, c.req.param("token")),
        eq(schema.channelToken.appId, app.id),
        eq(schema.channelToken.channel, channel),
        isNull(schema.channelToken.revokedAt),
      ),
    )
    .returning({ name: schema.channelToken.name })
  if (revoked) recordHistory("app", app.id, `Revoked the download token ${revoked.name}`, c.var.viewer.name)
  return c.json(await accessOf(app.id, channel))
})
