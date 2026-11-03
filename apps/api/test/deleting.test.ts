import { env } from "cloudflare:workers"
import { type DeletedProject, paths } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { GRACE_DAYS, purgeDeleted } from "../src/hosting/deletion.ts"
import { randomId } from "../src/lib/ids.ts"
import { json, person, publisherWithApp } from "./fixtures.ts"

const DAY = 86_400_000

async function released(appId: string) {
  const releaseId = randomId()
  const key = paths.artifact(appId, "1.0.0", "linux-x86_64", "Notes.AppImage")
  await db.insert(schema.release).values({
    id: releaseId,
    appId,
    version: "1.0.0",
    origin: "oidc",
    format: "appimage",
    manifest: "{}",
    requires: {},
    status: "live",
    rolloutPercent: 100,
    approvedAt: new Date(),
  })
  await db.update(schema.app).set({ status: "published" }).where(eq(schema.app.id, appId))
  await env.BUCKET.put(key, "AppImage")
  return key
}

async function owned() {
  const project = await publisherWithApp()
  return { ...project, owner: await person("Mira", project.userId) }
}

function recreate(owner: Awaited<ReturnType<typeof person>>, publisherId: string, id: string) {
  return owner.call("POST", `/publishers/${publisherId}/apps`, {
    id,
    kind: "app",
    format: "appimage",
    name: "Notes",
    distribution: "open",
  })
}

describe("deleting a project", () => {
  test("only owners and admins can delete one", async () => {
    const { appId, publisherId, owner } = await owned()
    const developer = await person("Bob")
    await db.insert(schema.member).values({ publisherId, userId: developer.id, role: "developer" })
    expect((await developer.call("DELETE", `/apps/${appId}`)).status).toBe(403)
    expect((await owner.call("DELETE", `/apps/${appId}`)).status).toBe(200)
  })

  test("a project that never shipped goes at once, and its id is free again", async () => {
    const { appId, publisherId, owner } = await owned()
    const draft = paths.media(appId, "icon", "png")
    await env.BUCKET.put(draft, "icon")
    const deleted = await json<DeletedProject>(await owner.call("DELETE", `/apps/${appId}`))
    expect(deleted.restorable_until).toBeNull()
    expect(await db.query.app.findFirst({ where: eq(schema.app.id, appId) })).toBeUndefined()
    expect(await env.BUCKET.head(draft)).toBeNull()
    expect((await recreate(owner, publisherId, appId)).status).toBe(201)
  })

  test("a released project keeps its id from everyone else, and can be restored", async () => {
    const { appId, owner } = await owned()
    await released(appId)
    const deleted = await json<DeletedProject>(await owner.call("DELETE", `/apps/${appId}`))
    expect(new Date(deleted.restorable_until!).getTime()).toBeGreaterThan(Date.now() + (GRACE_DAYS - 1) * DAY)

    const rival = await publisherWithApp()
    const prefix = appId.slice(0, appId.lastIndexOf("."))
    await db
      .update(schema.namespace)
      .set({ publisherId: rival.publisherId })
      .where(eq(schema.namespace.prefix, prefix))
    const rivalOwner = await person("Rival", rival.userId)
    expect((await recreate(rivalOwner, rival.publisherId, appId)).status).toBe(409)
    expect((await owner.call("GET", `/apps/${appId}`)).status).toBe(404)

    expect((await owner.call("POST", `/apps/${appId}/restore`)).status).toBe(204)
    const restored = await db.query.app.findFirst({ where: eq(schema.app.id, appId) })
    expect(restored?.status).toBe("published")
    expect(restored?.deletedAt).toBeNull()
  })

  test("after the grace period its files are purged, and only its publisher can use the id again", async () => {
    const { appId, publisherId, owner } = await owned()
    const file = await released(appId)
    await json(await owner.call("DELETE", `/apps/${appId}`))
    await db
      .update(schema.app)
      .set({ deletedAt: new Date(Date.now() - (GRACE_DAYS + 1) * DAY) })
      .where(eq(schema.app.id, appId))

    await purgeDeleted()

    expect(await env.BUCKET.head(file)).toBeNull()
    const tombstone = await db.query.app.findFirst({ where: eq(schema.app.id, appId) })
    expect(tombstone?.status).toBe("deleted")
    expect(tombstone?.purgedAt).not.toBeNull()
    expect(await db.$count(schema.release, eq(schema.release.appId, appId))).toBe(0)
    expect((await owner.call("POST", `/apps/${appId}/restore`)).status).toBe(409)
    expect((await recreate(owner, publisherId, appId)).status).toBe(201)
  })
})
