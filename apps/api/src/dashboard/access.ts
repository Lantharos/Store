import { and, eq } from "drizzle-orm"
import { db, schema } from "../db/client.ts"
import { github } from "../github/api.ts"

export async function githubAccount(userId: string) {
  const account = await db.query.account.findFirst({
    where: and(eq(schema.account.userId, userId), eq(schema.account.providerId, "github")),
  })
  if (!account?.accessToken) return null
  const user = await github<{ login: string; id: number }>("/user", { token: account.accessToken })
  return { login: user.login, token: account.accessToken }
}
