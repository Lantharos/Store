import { rollsOutGradually } from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"

export async function channelIsGradual(appId: string, name: string) {
  const channel = await db.query.channel.findFirst({
    where: and(eq(schema.channel.appId, appId), eq(schema.channel.name, name)),
  })
  return rollsOutGradually(name, channel?.gradual ?? null)
}
