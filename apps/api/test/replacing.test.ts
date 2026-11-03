import { env, exports } from "cloudflare:workers"
import { type AppIndex, type AppPage, paths } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { relist } from "../src/releases/moderation.ts"
import { replaceApp } from "../src/releases/replacing.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { json, publisherWithApp } from "./fixtures.ts"

async function published() {
  const { appId } = await publisherWithApp()
  await db.update(schema.app).set({ status: "published" }).where(eq(schema.app.id, appId))
  return appId
}

async function signedIndex(appId: string) {
  await rebuildApp(appId)
  return (await env.BUCKET.get(paths.app(appId)))!.json<AppIndex>()
}

const storePage = (appId: string) =>
  exports.default.fetch(new Request(`https://schelf.store/api/v1/apps/${appId}`)).then(json<AppPage>)

describe("replacing an app", () => {
  test("delists it and points its listing and page to the replacement until it's listed again", async () => {
    const [old, replacement] = await Promise.all([published(), published()])
    await replaceApp(old, replacement, "Rain grew into Seasons.")

    expect((await signedIndex(old)).replaced_by).toEqual({ id: replacement, note: "Rain grew into Seasons." })
    const page = await storePage(old)
    expect(page.status).toBe("delisted")
    expect(page.replacement).toMatchObject({ id: replacement, note: "Rain grew into Seasons." })
    expect(new URL(page.replacement!.page).pathname).toBe(`/apps/${replacement}`)

    await relist(old)
    expect((await signedIndex(old)).replaced_by).toBeUndefined()
    expect((await storePage(old)).replacement).toBeNull()
  })

  test("only points to an app that is listed", async () => {
    const [old, unlisted] = await Promise.all([
      published(),
      publisherWithApp().then((project) => project.appId),
    ])
    await expect(replaceApp(old, unlisted, "Moved.")).rejects.toThrow("There's no listed app with that id")
    await expect(replaceApp(old, old, "Moved.")).rejects.toThrow("An app can't replace itself")
  })
})
