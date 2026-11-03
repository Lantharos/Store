import { env, exports } from "cloudflare:workers"
import {
  type AppIndex,
  type CompleteResponse,
  importSigningKey,
  type PublishResponse,
  paths,
  sha256Hex,
  verifyDocument,
} from "@schelf/protocol"
import { describe, expect, test } from "vitest"
import { approve } from "../src/releases/review.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { bytesOf, publisherWithApp, schelfToml } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"
const PERMISSIONS = '[sandbox]\nfilesystems = ["xdg-documents"]\n'

async function publish(token: string, appId: string, file: Uint8Array<ArrayBuffer>, announcedSha?: string) {
  const response = await exports.default.fetch(
    new Request(`${API}/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        tag: "v1.0.0",
        schelf_toml: schelfToml(appId),
        permissions_toml: PERMISSIONS,
        files: [
          {
            name: "notes.AppImage",
            platform: "linux-x86_64",
            kind: "appimage",
            size: file.length,
            sha256: announcedSha ?? (await sha256Hex(file)),
          },
        ],
      }),
    }),
  )
  expect(response.status).toBe(201)
  return (await response.json()) as PublishResponse
}

function upload(started: PublishResponse, body: Uint8Array<ArrayBuffer>) {
  return exports.default.fetch(
    new Request(started.files[0]!.url, {
      method: "PUT",
      headers: { authorization: `Bearer ${started.upload_token}`, "content-length": String(body.length) },
      body,
    }),
  )
}

describe("publishing with a dashboard token", () => {
  test("a release uploads, passes the quick checks, waits for review and is signed on approval", async () => {
    const { appId, token } = await publisherWithApp()
    const file = bytesOf("an AppImage, honestly")
    const started = await publish(token, appId, file)
    expect(started.version).toBe("1.0.0")

    expect((await upload(started, file)).status).toBe(200)
    const completed = await exports.default.fetch(
      new Request(`${API}/publish/${started.release}/complete`, {
        method: "POST",
        headers: { authorization: `Bearer ${started.upload_token}` },
      }),
    )
    const result = (await completed.json()) as CompleteResponse
    expect(result.checks.filter((check) => check.status === "failed")).toEqual([])
    expect(result.status).toBe("in-review")

    await approve(started.release, "Reviewer")
    await rebuildApp(appId)

    const key = await importSigningKey(env.STORE_SIGNING_KEY)
    const [index, signature] = await Promise.all([
      env.BUCKET.get(paths.app(appId)).then((object) => object!.text()),
      env.BUCKET.get(paths.signature(paths.app(appId))).then((object) =>
        object!.json<{ key: string; sig: string }>(),
      ),
    ])
    expect(await verifyDocument(new Map([[key.id, key.publicKey]]), index, signature)).toBe(true)
    const document = JSON.parse(index) as AppIndex
    expect(document.releases[0]).toMatchObject({
      version: "1.0.0",
      rollout: { percent: 10, paused: false },
      access: "limited",
      provenance: { origin: "developer" },
    })
    expect(document.releases[0]!.artifacts[0]!.sha256).toBe(await sha256Hex(file))
  })

  test("a file that doesn't match its announced SHA-256 is refused and removed", async () => {
    const { appId, token } = await publisherWithApp()
    const file = bytesOf("the real build")
    const started = await publish(token, appId, file, await sha256Hex(bytesOf("a different build")))
    const response = await upload(started, file)
    expect(response.status).toBe(422)
    expect(await env.BUCKET.head(paths.artifact(appId, "1.0.0", "linux-x86_64", "notes.AppImage"))).toBeNull()
  })

  test("a token can't publish another publisher's app", async () => {
    const mine = await publisherWithApp()
    const theirs = await publisherWithApp()
    const response = await exports.default.fetch(
      new Request(`${API}/publish`, {
        method: "POST",
        headers: { authorization: `Bearer ${mine.token}`, "content-type": "application/json" },
        body: JSON.stringify({
          tag: "v1.0.0",
          schelf_toml: schelfToml(theirs.appId),
          permissions_toml: PERMISSIONS,
          files: [{ name: "a", platform: "linux-x86_64", kind: "appimage", size: 1, sha256: "0".repeat(64) }],
        }),
      }),
    )
    expect(response.status).toBe(403)
  })
})
