import { env, exports } from "cloudflare:workers"
import {
  type ApiError,
  type AppIndex,
  type CompleteResponse,
  type PublishResponse,
  paths,
  type ReleaseDetail,
  sha256Hex,
} from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { approve } from "../src/releases/review.ts"
import { allowInShell, allowPublisherInShell, refuseShell } from "../src/releases/shell.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { bytesOf, json, person, publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"

const schelfToml = (appId: string) =>
  `id = "${appId}"\nkind = "extension"\nformat = "luft-extension"\npermissions = "extension.toml"\n\n[requires]\nextension_api = 1\n`

const manifest = (appId: string, luft?: string) =>
  `id = "${appId}"\nname = "Rain"\napi = 1\npermissions = ["wallpaper"]\n${luft ? `\n[luft]\nminimum = "${luft}"\n` : ""}`

async function extension() {
  const owner = await publisherWithApp("luft-extension")
  await db
    .update(schema.listingMeta)
    .set({ iconKey: `media/${owner.appId}/icon.svg` })
    .where(eq(schema.listingMeta.appId, owner.appId))
  await db
    .update(schema.publisher)
    .set({ createdAt: new Date("2026-01-01") })
    .where(eq(schema.publisher.id, owner.publisherId))
  return owner
}

function start(token: string, appId: string, file: Uint8Array<ArrayBuffer>, version: string, luft?: string) {
  return sha256Hex(file).then((sha256) =>
    exports.default.fetch(
      new Request(`${API}/publish`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          version,
          schelf_toml: schelfToml(appId),
          permissions_toml: manifest(appId, luft),
          files: [{ name: "rain.tar.zst", platform: "luft", kind: "extension", size: file.length, sha256 }],
        }),
      }),
    ),
  )
}

async function shipped(token: string, appId: string, version: string, luft: string) {
  const file = bytesOf(`rain ${version}`)
  const started = (await (await start(token, appId, file, version, luft)).json()) as PublishResponse
  await exports.default.fetch(
    new Request(started.files[0]!.url, {
      method: "PUT",
      headers: { authorization: `Bearer ${started.upload_token}`, "content-length": String(file.length) },
      body: file,
    }),
  )
  const completed = await exports.default.fetch(
    new Request(`${API}/publish/${started.release}/complete`, {
      method: "POST",
      headers: { authorization: `Bearer ${started.upload_token}` },
    }),
  )
  expect(((await completed.json()) as CompleteResponse).status).toBe("in-review")
  await approve(started.release, "Reviewer")
  return started.release
}

async function index(appId: string) {
  await rebuildApp(appId)
  return env.BUCKET.get(paths.app(appId)).then((object) => object!.json<AppIndex>())
}

const verify = (publisherId: string, verifiedAt: Date | null) =>
  db.update(schema.publisher).set({ verifiedAt }).where(eq(schema.publisher.id, publisherId))

describe("the Luft an extension needs", () => {
  test("an extension release without [luft] minimum is refused before anything uploads, saying what to add", async () => {
    const { appId, token } = await extension()
    const response = await start(token, appId, bytesOf("rain"), "1.0.0")
    expect(response.status).toBe(422)
    expect(((await response.json()) as ApiError).error).toContain('add [luft] with minimum = "1.0"')
  })

  test("goes into the signed index, and an older Luft keeps a release it can run", async () => {
    const { appId, token } = await extension()
    await shipped(token, appId, "1.0.0", "1.0-nightly.27")
    for (const patch of [1, 2, 3, 4, 5]) await shipped(token, appId, `1.1.${patch}`, "1.2")

    const { releases } = await index(appId)
    expect(releases.find((release) => release.version === "1.0.0")).toMatchObject({
      requires: { extension_api: 1, luft: "1.0-nightly.27" },
      runs_in_shell: false,
    })
    expect(releases.find((release) => release.version === "1.1.5")?.requires.luft).toBe("1.2")
  })
})

describe("running inside Luft", () => {
  test("only a verified publisher can ask, and the owner's approval of those files is what the index says", async () => {
    const { appId, publisherId, userId, token } = await extension()
    const releaseId = await shipped(token, appId, "1.0.0", "1.0")
    const mira = await person("Mira", userId)
    const ask = () => mira.call("POST", `/apps/${appId}/releases/${releaseId}/inside-luft`)

    expect((await ask()).status).toBe(403)
    await verify(publisherId, new Date())
    const asked = await json<ReleaseDetail>(await ask())
    expect(asked.shell).toMatchObject({ review: "waiting", runs_in_shell: false, requestable: false })
    expect((await index(appId)).releases[0]!.runs_in_shell).toBe(false)

    await allowInShell(releaseId, "Owner")
    expect((await index(appId)).releases[0]!.runs_in_shell).toBe(true)

    await verify(publisherId, null)
    expect((await index(appId)).releases[0]!.runs_in_shell).toBe(false)
  })

  test("a refusal keeps the release installable and tells the developer why", async () => {
    const { appId, publisherId, userId, token } = await extension()
    await verify(publisherId, new Date())
    const releaseId = await shipped(token, appId, "1.0.0", "1.0")
    await allowInShell(releaseId, "Owner")
    await refuseShell(releaseId, "Owner", "The helper reads every file in your home folder")

    const detail = await json<ReleaseDetail>(
      await (await person("Mira", userId)).call("GET", `/apps/${appId}/releases/${releaseId}`),
    )
    expect(detail.shell).toMatchObject({
      review: "refused",
      reason: "The helper reads every file in your home folder",
    })
    const { releases } = await index(appId)
    expect(releases[0]).toMatchObject({ version: "1.0.0", runs_in_shell: false })
  })

  test("the owner can approve a publisher's shipped releases in one step, leaving refused ones", async () => {
    const { appId, publisherId, token } = await extension()
    await verify(publisherId, new Date())
    const refused = await shipped(token, appId, "1.0.0", "1.0")
    await refuseShell(refused, "Owner", "Not this one")
    await shipped(token, appId, "1.1.0", "1.0")

    expect(await allowPublisherInShell(publisherId, "Owner")).toContain("1 release ")
    const { releases } = await index(appId)
    expect(Object.fromEntries(releases.map((release) => [release.version, release.runs_in_shell]))).toEqual({
      "1.1.0": true,
      "1.0.0": false,
    })
  })
})
