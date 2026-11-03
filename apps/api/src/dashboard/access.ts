import { and, eq } from "drizzle-orm"
import type { Developer } from "../auth/session.ts"
import { db, schema } from "../db/client.ts"
import { github } from "../github/api.ts"
import { fail } from "../lib/http.ts"

export async function ownedApp(developer: Developer, id: string) {
  const app = await db.query.app.findFirst({
    where: and(eq(schema.app.id, id), eq(schema.app.developerId, developer.id)),
  })
  if (!app) fail(404, "You don't have an app with that id")
  return app
}

export async function ownedRelease(developer: Developer, appId: string, releaseId: string) {
  const app = await ownedApp(developer, appId)
  const release = await db.query.release.findFirst({
    where: and(eq(schema.release.id, releaseId), eq(schema.release.appId, app.id)),
  })
  if (!release) fail(404, "That release doesn't exist")
  return { app, release }
}

export async function githubAccount(userId: string) {
  const account = await db.query.account.findFirst({
    where: and(eq(schema.account.userId, userId), eq(schema.account.providerId, "github")),
  })
  if (!account?.accessToken) return null
  const user = await github<{ login: string; id: number }>("/user", { token: account.accessToken })
  return { login: user.login, token: account.accessToken }
}
