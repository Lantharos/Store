import { rollsOutGradually } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { among, db, schema } from "../db/client.ts"

export async function channelIsGradual(appId: string, name: string) {
  const channel = await db.query.channel.findFirst({
    where: and(eq(schema.channel.appId, appId), eq(schema.channel.name, name)),
  })
  return rollsOutGradually(name, channel?.gradual ?? null)
}

/** Whether each channel of these apps rolls out gradually, read in one go. */
export async function gradualChannels(appIds: string[]) {
  const rows = await db
    .select({ appId: schema.channel.appId, name: schema.channel.name, gradual: schema.channel.gradual })
    .from(schema.channel)
    .where(among(schema.channel.appId, appIds))
  const settings = new Map(rows.map((row) => [`${row.appId}\n${row.name}`, row.gradual]))
  return (appId: string, name: string) => rollsOutGradually(name, settings.get(`${appId}\n${name}`) ?? null)
}
