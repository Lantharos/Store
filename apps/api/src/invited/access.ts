import { CHANNEL_TOKEN_PREFIX, sha256Hex } from "@schelf/protocol"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { auth } from "../auth/auth.ts"
import { db, schema } from "../db/client.ts"
import { bearer } from "../lib/http.ts"
import type { AppRow } from "../signing/records.ts"
import { signedFor } from "./links.ts"

async function tokenOpens(token: string, appId: string, channels: string[]) {
  const [used] = await db
    .update(schema.channelToken)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(schema.channelToken.hash, await sha256Hex(token)),
        eq(schema.channelToken.appId, appId),
        inArray(schema.channelToken.channel, channels),
        isNull(schema.channelToken.revokedAt),
      ),
    )
    .returning({ id: schema.channelToken.id })
  return !!used
}

export async function personOpens(
  user: { id: string; email: string; emailVerified: boolean },
  app: Pick<AppRow, "id" | "publisherId">,
  channels: string[],
) {
  const [member, invited] = await Promise.all([
    db.$count(
      schema.member,
      and(eq(schema.member.publisherId, app.publisherId), eq(schema.member.userId, user.id)),
    ),
    user.emailVerified
      ? db.$count(
          schema.channelInvite,
          and(
            eq(schema.channelInvite.appId, app.id),
            inArray(schema.channelInvite.channel, channels),
            eq(schema.channelInvite.email, sql`lower(${user.email})`),
          ),
        )
      : 0,
  ])
  return member + invited > 0
}

/** Whether the request's token or signed-in person may download from any of `channels`. */
export async function channelsOpenTo(
  request: Request,
  app: Pick<AppRow, "id" | "publisherId">,
  channels: string[],
) {
  const credential = bearer(request)
  if (credential?.startsWith(CHANNEL_TOKEN_PREFIX)) return tokenOpens(credential, app.id, channels)
  const session = await auth.api.getSession({ headers: request.headers })
  return !!session && personOpens(session.user, app, channels)
}

function ownerOfKey(key: string) {
  const [, root, ...rest] = key.split("/")
  if (root === "apps") return { app: rest[0]!, channel: null }
  if (root === "sabine") return { app: rest[0]!, channel: rest.at(-1)!.replace(/\.json(\.sig)?$/, "") }
  if (root === "index") return { app: rest[2]!, channel: rest[3]!.replace(/\.json(\.sig)?$/, "") }
  return null
}

async function channelsUsing(key: string) {
  const rows = await db
    .selectDistinct({ channel: schema.release.channel, inviteOnly: schema.channel.inviteOnly })
    .from(schema.artifact)
    .innerJoin(schema.release, eq(schema.release.id, schema.artifact.releaseId))
    .innerJoin(
      schema.channel,
      and(eq(schema.channel.appId, schema.release.appId), eq(schema.channel.name, schema.release.channel)),
    )
    .where(eq(schema.artifact.key, key))
  return rows
}

async function artifactKeyOf(key: string) {
  if (!key.includes("/deltas/")) return key.replace(/\.blockmap$/, "")
  const [row] = await db
    .select({ key: schema.artifact.key })
    .from(schema.delta)
    .innerJoin(schema.artifact, eq(schema.artifact.id, schema.delta.artifactId))
    .where(eq(schema.delta.key, key))
  return row?.key ?? null
}

/** Whether an invited/ file may be served: signed for, on an open channel too, or opened by the request. */
export async function invitedFileOpen(request: Request, key: string) {
  if (await signedFor(new URL(request.url), key)) return true
  const owner = ownerOfKey(key)
  if (!owner) return false
  const app = await db.query.app.findFirst({ where: eq(schema.app.id, owner.app) })
  if (!app) return false
  if (owner.channel) return channelsOpenTo(request, app, [owner.channel])
  const artifactKey = await artifactKeyOf(key)
  const channels = artifactKey ? await channelsUsing(artifactKey) : []
  if (channels.some((row) => !row.inviteOnly)) return true
  return (
    channels.length > 0 &&
    channelsOpenTo(
      request,
      app,
      channels.map((row) => row.channel),
    )
  )
}
