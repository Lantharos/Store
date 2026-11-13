import { CHANNEL_TOKEN_PREFIX, sha256Hex } from "@schelf/protocol"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { auth } from "../auth/auth.ts"
import { renewAppSession } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { bearer } from "../lib/http.ts"
import type { AppRow } from "../signing/records.ts"
import { signedFor } from "./links.ts"

/** open: may download; anonymous: no valid sign-in or token (401); refused: valid, but not let in (403). */
export type Access = "open" | "anonymous" | "refused"

type Asker =
  | { kind: "token"; id: string; appId: string; channel: string }
  | { kind: "person"; user: { id: string; email: string; emailVerified: boolean } }

async function askerOf(request: Request): Promise<Asker | null> {
  const credential = bearer(request)
  if (credential?.startsWith(CHANNEL_TOKEN_PREFIX)) {
    const token = await db.query.channelToken.findFirst({
      where: and(
        eq(schema.channelToken.hash, await sha256Hex(credential)),
        isNull(schema.channelToken.revokedAt),
      ),
    })
    return token ? { kind: "token", id: token.id, appId: token.appId, channel: token.channel } : null
  }
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null
  await renewAppSession(session.session)
  return { kind: "person", user: session.user }
}

async function opens(asker: Asker, app: Pick<AppRow, "id" | "publisherId">, channels: string[]) {
  if (asker.kind === "person") return personOpens(asker.user, app, channels)
  if (asker.appId !== app.id || !channels.includes(asker.channel)) return false
  await db
    .update(schema.channelToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.channelToken.id, asker.id))
  return true
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
): Promise<Access> {
  const asker = await askerOf(request)
  if (!asker) return "anonymous"
  return (await opens(asker, app, channels)) ? "open" : "refused"
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
export async function invitedFileOpen(request: Request, key: string): Promise<Access> {
  if (await signedFor(new URL(request.url), key)) return "open"
  const owner = ownerOfKey(key)
  const app = owner && (await db.query.app.findFirst({ where: eq(schema.app.id, owner.app) }))
  const artifactKey = app && !owner.channel ? await artifactKeyOf(key) : null
  const channels = artifactKey ? await channelsUsing(artifactKey) : []
  if (channels.some((row) => !row.inviteOnly)) return "open"
  const wanted = owner?.channel ? [owner.channel] : channels.map((row) => row.channel)
  if (!app || !wanted.length) return (await askerOf(request)) ? "refused" : "anonymous"
  return channelsOpenTo(request, app, wanted)
}

/** The answer for a request that may not have an invited file or link. */
export function shutOut(access: Exclude<Access, "open">) {
  return access === "anonymous"
    ? new Response("This is for invited people. Sign in to Schelf or send a download token.", {
        status: 401,
        headers: { "www-authenticate": "Bearer", "cache-control": "no-store" },
      })
    : new Response("You aren't invited to this.", { status: 403, headers: { "cache-control": "no-store" } })
}
