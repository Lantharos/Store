import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"

export async function forgetUploadedAvatar(userId: string) {
  const user = await db.query.user.findFirst({ where: eq(schema.user.id, userId) })
  if (user?.avatarKey) await env.BUCKET.delete(user.avatarKey)
}
