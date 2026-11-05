import { env, exports } from "cloudflare:workers"
import {
  type AppIndex,
  type AppSettings,
  importSigningKey,
  type ProjectDownloads,
  paths,
  type SabineFeed,
  verifySabineFeed,
} from "@schelf/protocol"
import { and, eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { ensureChannel, pruneChannel } from "../src/hosting/channels.ts"
import { deleteProject } from "../src/hosting/deletion.ts"
import { randomId } from "../src/lib/ids.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { json, person, publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"
const DL = "https://dl.schelf.store"
type Updater = "electron" | "tauri" | "sabine"

let clock = Date.parse("2026-10-01T00:00:00Z")

async function ship(
  appId: string,
  version: string,
  channel: string,
  updater: Updater = "electron",
  { percent = 100, status }: { percent?: number; status?: "in-review" } = {},
) {
  const id = randomId()
  const name = `notes-${version}.exe`
  await ensureChannel(appId, channel)
  clock += 86_400_000
  await db.insert(schema.release).values({
    id,
    appId,
    version,
    channel,
    origin: "oidc",
    format: updater === "sabine" ? "sabine" : "files",
    updater,
    manifest: "",
    requires: {},
    status: status ?? (percent === 100 ? "live" : "rolling-out"),
    rolloutPercent: percent,
    approvedAt: new Date(clock),
  })
  await db.insert(schema.artifact).values({
    id: randomId(),
    releaseId: id,
    name,
    platform: "windows-x86_64",
    format: updater === "sabine" ? "sabine" : "files",
    kind: updater === "sabine" ? "archive" : "exe",
    key: paths.artifact(appId, version, "windows-x86_64", name),
    size: 10,
    sha256: "a".repeat(64),
    sha512: "b".repeat(88),
    signature: "c2lnbmVk",
    executable: updater === "sabine" ? "Notes.exe" : null,
  })
  return id
}

async function project(updater: Updater = "electron") {
  const created = await publisherWithApp(updater === "sabine" ? "sabine" : "files")
  await db
    .update(schema.app)
    .set({ status: "published", visibility: "unlisted", updater })
    .where(eq(schema.app.id, created.appId))
  const owner = await person("Mira", created.userId)
  const end = (name: string, into: string) =>
    owner.call("POST", `/apps/${created.appId}/channels/${name}/end`, { into })
  const reopen = (name: string) => owner.call("POST", `/apps/${created.appId}/channels/${name}/reopen`)
  const hosted = (path: string) =>
    exports.default.fetch(new Request(`${DL}/${created.publisherSlug}/notes/${path}`, { redirect: "manual" }))
  return { ...created, owner, end, reopen, hosted }
}

const signedIndex = async (appId: string) => {
  await rebuildApp(appId)
  return (await env.BUCKET.get(paths.app(appId)))!.json<AppIndex>()
}

const sabineFeed = (appId: string, channel: string) =>
  env.BUCKET.get(paths.sabine(appId, channel)).then((object) => object!.json<SabineFeed>())

function publish(token: string, appId: string, version: string, channel?: string) {
  return exports.default.fetch(
    new Request(`${API}/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        version,
        channel,
        schelf_toml: `id = "${appId}"\nformat = "files"\n`,
        notes: "",
        files: [
          { name: "notes.exe", platform: "windows-x86_64", kind: "exe", size: 4, sha256: "d".repeat(64) },
        ],
      }),
    }),
  )
}

const message = (response: Response) => response.json<{ error: string }>().then((body) => body.error)

describe("ending a channel", () => {
  test("answers its links with the destination, and old versions stay reachable", async () => {
    const { appId, end, hosted } = await project()
    await ship(appId, "1.0.0", "stable")
    await ship(appId, "2.0.0-beta.1", "beta")
    await json(await end("beta", "stable"))

    const link = await hosted("@beta/latest/windows")
    expect(link.status).toBe(302)
    expect(link.headers.get("location")).toContain("notes-1.0.0.exe")
    const listed = await json<ProjectDownloads>(await hosted("@beta/latest.json"))
    expect([listed.channel, listed.version]).toEqual(["stable", "1.0.0"])
    expect((await hosted("@beta/v/2.0.0-beta.1/windows")).headers.get("location")).toContain("2.0.0-beta.1")
  })

  test("keeps links serving the ended channel while the destination has nothing", async () => {
    const { appId, end, hosted } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")
    await json(await end("beta", "stable"))

    expect((await hosted("@beta/latest/windows")).headers.get("location")).toContain("2.0.0-beta.1")
  })

  test("is shown in the settings, and only reaches channels that exist", async () => {
    const { appId, end } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")

    expect((await end("stable", "beta")).status).toBe(409)
    expect((await end("beta", "beta")).status).toBe(422)
    expect((await end("beta", "nowhere")).status).toBe(404)
    expect((await end("nowhere", "stable")).status).toBe(404)
    const settings = await json<AppSettings>(await end("beta", "stable"))
    expect(settings.channels.find((channel) => channel.name === "beta")?.ended_into).toBe("stable")
    expect((await end("beta", "stable")).status).toBe(409)
  })

  test("needs a place in the publisher", async () => {
    const { appId } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")
    const stranger = await person("Eve")

    const refused = await stranger.call("POST", `/apps/${appId}/channels/beta/end`, { into: "stable" })

    expect(refused.status).toBeGreaterThanOrEqual(403)
    expect(refused.status).toBeLessThan(405)
  })

  test("waits for a release that's still being reviewed", async () => {
    const { appId, end } = await project()
    await ship(appId, "2.0.0-beta.1", "beta", "electron", { percent: 0, status: "in-review" })

    expect((await end("beta", "stable")).status).toBe(409)
  })
})

describe("nobody downgrades", () => {
  test("electron-updater keeps the channel's newest until the destination catches up", async () => {
    const { appId, end, hosted } = await project()
    await ship(appId, "1.9.0", "stable")
    await ship(appId, "2.0.0-beta.3", "beta")
    await json(await end("beta", "stable"))

    expect(await (await hosted("beta.yml")).text()).toContain('version: "2.0.0-beta.3"')
  })

  test("electron-updater moves on once the destination is newer", async () => {
    const { appId, end, hosted } = await project()
    await ship(appId, "2.0.0-beta.3", "beta")
    await ship(appId, "2.0.0", "stable")
    await json(await end("beta", "stable"))

    expect(await (await hosted("beta.yml")).text()).toContain('version: "2.0.0"')
  })

  test("Tauri is never offered less than the channel had", async () => {
    const { appId, end, hosted } = await project("tauri")
    await ship(appId, "1.9.0", "stable", "tauri")
    await ship(appId, "2.0.0-beta.3", "beta", "tauri")
    await json(await end("beta", "stable"))

    const feed = await json<{ version: string }>(await hosted("@beta/tauri.json"))
    expect(feed.version).toBe("2.0.0-beta.3")
  })

  test("a rollout that misses the device leaves it on the channel's newest", async () => {
    const { appId, end, hosted } = await project("tauri")
    await ship(appId, "2.0.0-beta.3", "beta", "tauri")
    await ship(appId, "2.0.0", "stable", "tauri", { percent: 1 })
    await json(await end("beta", "stable"))

    const feed = await json<{ version: string }>(await hosted("@beta/tauri.json"))
    expect(feed.version).toBe("2.0.0-beta.3")
  })
})

describe("signed documents", () => {
  test("the app's index carries where each ended channel points", async () => {
    const { appId, end } = await project()
    await ship(appId, "1.0.0", "stable")
    await ship(appId, "2.0.0-beta.1", "beta")
    expect((await signedIndex(appId)).ended_channels).toBeUndefined()
    await json(await end("beta", "stable"))

    const index = await signedIndex(appId)
    expect(index.ended_channels).toEqual({ beta: "stable" })
    expect(index.releases.map((release) => release.version)).toContain("2.0.0-beta.1")
  })

  test("a Sabine feed answers with the destination under its own channel, which Sabine insists on", async () => {
    const { appId, end } = await project("sabine")
    await ship(appId, "1.0.0", "stable", "sabine")
    await ship(appId, "2.0.0-beta.1", "beta", "sabine")
    await json(await end("beta", "stable"))
    await rebuildApp(appId)

    const feed = await sabineFeed(appId, "beta")
    const key = await importSigningKey(env.STORE_SIGNING_KEY)
    expect([feed.channel, feed.version]).toEqual(["beta", "1.0.0"])
    expect(await verifySabineFeed(key.publicKey, feed)).toBe(true)
  })

  test("a Sabine feed stays on the channel while the destination has no Sabine release", async () => {
    const { appId, end } = await project("sabine")
    await ship(appId, "2.0.0-beta.1", "beta", "sabine")
    await json(await end("beta", "stable"))
    await rebuildApp(appId)

    expect((await sabineFeed(appId, "beta")).version).toBe("2.0.0-beta.1")
  })
})

describe("publishing to an ended channel", () => {
  test("is refused when the version names the channel, saying how to reopen it", async () => {
    const { appId, token, end } = await project()
    await ship(appId, "1.0.0", "stable")
    await ship(appId, "2.0.0-beta.1", "beta")
    await json(await end("beta", "stable"))

    const refused = await publish(token, appId, "2.0.0-beta.2")

    expect(refused.status).toBe(409)
    const text = await message(refused)
    expect(text).toContain("beta")
    expect(text).toContain("reopen")
  })

  test("is refused when it's named outright, and works again once reopened", async () => {
    const { appId, token, end, reopen } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")
    await json(await end("beta", "stable"))

    expect((await publish(token, appId, "3.0.0", "beta")).status).toBe(409)
    await json(await reopen("beta"))
    expect((await publish(token, appId, "3.0.0", "beta")).status).toBe(201)
  })

  test("is refused for uploads and promotes, while the ended channel's releases can still leave it", async () => {
    const { appId, owner, end } = await project()
    const source = await ship(appId, "1.0.0", "stable")
    const beta = await ship(appId, "2.0.0-beta.1", "beta")
    await json(await end("beta", "stable"))

    const upload = await owner.call("POST", `/apps/${appId}/uploads`, {
      version: "2.0.0-beta.2",
      notes: "",
      bridge: false,
      files: [
        { name: "notes.exe", platform: "windows-x86_64", kind: "exe", size: 4, sha256: "d".repeat(64) },
      ],
    })
    expect(upload.status).toBe(409)
    const promote = (id: string, channel: string) =>
      owner.call("POST", `/apps/${appId}/releases/${id}/promote`, { channel })
    expect((await promote(source, "beta")).status).toBe(409)
    expect((await promote(beta, "stable")).status).toBe(201)
  })

  test("is refused for an upload that finishes after the channel ended", async () => {
    const { appId, token, end } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")
    const started = await json<{ release: string; upload_token: string }>(
      await publish(token, appId, "2.0.0-beta.2"),
    )
    await json(await end("beta", "stable"))

    const completed = await exports.default.fetch(
      new Request(`${API}/publish/${started.release}/complete`, {
        method: "POST",
        headers: { authorization: `Bearer ${started.upload_token}`, "content-type": "application/json" },
        body: "{}",
      }),
    )

    expect(completed.status).toBe(409)
    expect(await message(completed)).toContain("reopen")
  })
})

describe("channels that end later", () => {
  test("follow the destination to where it points now", async () => {
    const { appId, end, hosted } = await project()
    await ship(appId, "1.0.0", "stable")
    await ship(appId, "2.0.0-beta.1", "beta")
    await ship(appId, "3.0.0-nightly.1", "nightly")
    await json(await end("beta", "nightly"))
    const settings = await json<AppSettings>(await end("nightly", "stable"))

    expect(settings.channels.find((channel) => channel.name === "beta")?.ended_into).toBe("stable")
    expect((await signedIndex(appId)).ended_channels).toEqual({ beta: "stable", nightly: "stable" })
    expect((await hosted("@beta/latest/windows")).headers.get("location")).toContain("notes-1.0.0.exe")
  })

  test("can't point back at each other", async () => {
    const { appId, end } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")
    await ship(appId, "3.0.0-nightly.1", "nightly")
    await json(await end("beta", "nightly"))

    expect((await end("nightly", "beta")).status).toBe(409)
  })

  test("come back through a destination that reopens", async () => {
    const { appId, end, reopen } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")
    await ship(appId, "3.0.0-nightly.1", "nightly")
    await json(await end("beta", "nightly"))
    await json(await end("nightly", "stable"))
    await json(await reopen("nightly"))

    expect((await signedIndex(appId)).ended_channels).toEqual({ beta: "nightly" })
  })
})

describe("reopening a channel", () => {
  test("gives it back its own releases, with its history intact", async () => {
    const { appId, end, reopen, hosted } = await project()
    await ship(appId, "1.0.0", "stable")
    await ship(appId, "2.0.0-beta.1", "beta")
    await json(await end("beta", "stable"))
    const settings = await json<AppSettings>(await reopen("beta"))

    expect(settings.channels.find((channel) => channel.name === "beta")).toMatchObject({
      ended_into: null,
      releases: 1,
    })
    expect((await signedIndex(appId)).ended_channels).toBeUndefined()
    expect((await hosted("@beta/latest/windows")).headers.get("location")).toContain("2.0.0-beta.1")
  })

  test("is refused for a channel that's open", async () => {
    const { appId, reopen } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")

    expect((await reopen("beta")).status).toBe(409)
  })
})

describe("the rest of a project's life", () => {
  test("pruning still trims an ended channel", async () => {
    const { appId, end } = await project()
    await ship(appId, "2.0.0-beta.1", "beta")
    await ship(appId, "2.0.0-beta.2", "beta")
    await ship(appId, "2.0.0-beta.3", "beta")
    await json(await end("beta", "stable"))

    await pruneChannel(appId, "beta", 2)

    const left = await db
      .select({ version: schema.release.version })
      .from(schema.release)
      .where(and(eq(schema.release.appId, appId), eq(schema.release.channel, "beta")))
    expect(left.map((release) => release.version).sort()).toEqual(["2.0.0-beta.2", "2.0.0-beta.3"])
  })

  test("deleting a project with an ended channel leaves no feeds and an empty index", async () => {
    const { appId, end, owner } = await project("sabine")
    await ship(appId, "1.0.0", "stable", "sabine")
    await ship(appId, "2.0.0-beta.1", "beta", "sabine")
    await json(await end("beta", "stable"))
    await rebuildApp(appId)
    const app = (await db.query.app.findFirst({ where: eq(schema.app.id, appId) }))!

    await deleteProject(app, owner.id)

    expect((await signedIndex(appId)).releases).toEqual([])
    expect(await env.BUCKET.head(paths.sabine(appId, "beta"))).toBeNull()
  })

  test("a move to a new framework keeps the old feed alive for people on the ended channel", async () => {
    const { appId, end, hosted } = await project()
    await ship(appId, "2.0.0-beta.1", "beta", "electron")
    await ship(appId, "2.0.0", "stable", "tauri")
    await json(await end("beta", "stable"))

    expect(await (await hosted("beta.yml")).text()).toContain('version: "2.0.0-beta.1"')
    expect((await json<{ version: string }>(await hosted("@beta/tauri.json"))).version).toBe("2.0.0")
  })
})
