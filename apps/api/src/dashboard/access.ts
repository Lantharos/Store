import { APIError } from "better-auth/api"
import { and, eq } from "drizzle-orm"
import { auth } from "../auth/auth.ts"
import { db, schema } from "../db/client.ts"
import { github } from "../github/api.ts"

async function freshToken(accountId: string, userId: string) {
  try {
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId, userId } })
    return accessToken
  } catch (error) {
    if (error instanceof APIError) return null
    throw error
  }
}

export async function githubAccount(userId: string) {
  const account = await db.query.account.findFirst({
    where: and(eq(schema.account.userId, userId), eq(schema.account.providerId, "github")),
  })
  if (!account?.accessToken) return null
  const token = await freshToken(account.id, userId)
  if (!token) return null
  const user = await github<{ login: string; id: number }>("/user", { token })
  return { login: user.login, id: String(user.id), token }
}
