import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"

export async function inviteOnlyChannels(appId: string) {
  const rows = await db
    .select({ name: schema.channel.name })
    .from(schema.channel)
    .where(and(eq(schema.channel.appId, appId), eq(schema.channel.inviteOnly, true)))
  return new Set(rows.map((row) => row.name))
}
