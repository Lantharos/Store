import { channelNow, channelPath, endedChannelsOf, STABLE } from "@schelf/protocol"
import { and, eq, inArray, isNotNull, isNull, notExists } from "drizzle-orm"
import { alias } from "drizzle-orm/sqlite-core"
import { db, schema } from "../db/client.ts"
import { fail } from "../lib/http.ts"
import { recordHistory } from "../ops/events.ts"
import { resignApp } from "../signing/queue.ts"
import type { AppRow } from "../signing/records.ts"

const ON_ITS_WAY = ["checking", "in-review"] as const

function channelsOf(appId: string) {
  return db.select().from(schema.channel).where(eq(schema.channel.appId, appId))
}

async function endedChannels(appId: string) {
  return endedChannelsOf(await channelsOf(appId))
}

export async function channelRoute(appId: string, channel: string) {
  return channel === STABLE ? [STABLE] : channelPath(channel, await endedChannels(appId))
}

export async function refuseEnded(appId: string, channel: string) {
  const ended = await endedChannels(appId)
  if (!ended.has(channel)) return
  const now = channelNow(channel, ended)
  fail(
    409,
    `The ${channel} channel has ended and points to ${now}. Publish to ${now}, or reopen ${channel} on the project's Updates page in the dashboard.`,
  )
}

export async function endChannel(app: AppRow, name: string, into: string, by: string) {
  if (name === STABLE) fail(409, "Stable can't be ended")
  if (into === name) fail(422, `Choose a channel other than ${name}`)
  const channels = await channelsOf(app.id)
  const channel = channels.find((row) => row.name === name)
  if (!channel) fail(404, `There's no ${name} channel`)
  if (channel.endedInto) fail(409, `${name} has ended already`)
  const destination = channels.find((row) => row.name === into)
  if (!destination && into !== STABLE) fail(404, `There's no ${into} channel`)
  if (destination?.endedInto) fail(409, `${into} has ended too. Choose a channel that's still open`)
  const waiting = await db.$count(
    schema.release,
    and(
      eq(schema.release.appId, app.id),
      eq(schema.release.channel, name),
      inArray(schema.release.status, [...ON_ITS_WAY]),
    ),
  )
  if (waiting)
    fail(409, `A release on ${name} is still being checked or reviewed. End it once that's decided`)

  const target = alias(schema.channel, "target")
  const endedTarget = db
    .select({ name: target.name })
    .from(target)
    .where(and(eq(target.appId, app.id), eq(target.name, into), isNotNull(target.endedInto)))
  const ended = await db
    .update(schema.channel)
    .set({ endedInto: into })
    .where(
      and(
        eq(schema.channel.appId, app.id),
        eq(schema.channel.name, name),
        isNull(schema.channel.endedInto),
        notExists(endedTarget),
      ),
    )
    .returning({ name: schema.channel.name })
  if (!ended.length) fail(409, `${into} ended at the same moment. Choose a channel that's still open`)
  recordHistory("app", app.id, `Ended ${name}; people on it move to ${into}`, by)
  await resignApp(app.id)
}

export async function reopenChannel(app: AppRow, name: string, by: string) {
  const reopened = await db
    .update(schema.channel)
    .set({ endedInto: null })
    .where(
      and(
        eq(schema.channel.appId, app.id),
        eq(schema.channel.name, name),
        isNotNull(schema.channel.endedInto),
      ),
    )
    .returning({ name: schema.channel.name })
  if (!reopened.length) fail(409, `${name} isn't ended`)
  recordHistory("app", app.id, `Reopened ${name}`, by)
  await resignApp(app.id)
}
