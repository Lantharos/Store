import { env, exports } from "cloudflare:workers"
import {
  type AppIndex,
  type CompleteResponse,
  importSigningKey,
  type PublishedRelease,
  type PublishedReleases,
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

interface Release {
  version?: string
  channel?: string
  announcedSha?: string
  listingToml?: string
}

async function start(token: string, appId: string, file: Uint8Array<ArrayBuffer>, release: Release = {}) {
  return exports.default.fetch(
    new Request(`${API}/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        version: release.version ?? "1.0.0",
        channel: release.channel,
        schelf_toml: schelfToml(appId),
        permissions_toml: PERMISSIONS,
        listing_toml: release.listingToml,
        files: [
          {
            name: "notes.AppImage",
            platform: "linux-x86_64",
            kind: "appimage",
            size: file.length,
            sha256: release.announcedSha ?? (await sha256Hex(file)),
          },
        ],
      }),
    }),
  )
}

async function publish(token: string, appId: string, file: Uint8Array<ArrayBuffer>, release?: Release) {
  const response = await start(token, appId, file, release)
  expect(response.status).toBe(201)
  return (await response.json()) as PublishResponse
}

async function uploadAndComplete(started: PublishResponse, file: Uint8Array<ArrayBuffer>) {
  expect((await upload(started, file)).status).toBe(200)
  const completed = await exports.default.fetch(
    new Request(`${API}/publish/${started.release}/complete`, {
      method: "POST",
      headers: { authorization: `Bearer ${started.upload_token}` },
    }),
  )
  return (await completed.json()) as CompleteResponse
}

const versionCheck = (result: CompleteResponse) => result.checks.find((check) => check.name === "version")

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

    const result = await uploadAndComplete(started, file)
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
    const started = await publish(token, appId, file, {
      announcedSha: await sha256Hex(bytesOf("a different build")),
    })
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
          version: "1.0.0",
          schelf_toml: schelfToml(theirs.appId),
          permissions_toml: PERMISSIONS,
          files: [{ name: "a", platform: "linux-x86_64", kind: "appimage", size: 1, sha256: "0".repeat(64) }],
        }),
      }),
    )
    expect(response.status).toBe(403)
  })

  test("a version that was already published is refused", async () => {
    const { appId, token } = await publisherWithApp()
    const file = bytesOf("the first build")
    await uploadAndComplete(await publish(token, appId, file), file)
    const again = await start(token, appId, bytesOf("a rebuild"), { channel: "beta" })
    expect(again.status).toBe(409)
  })

  test("a version only has to be newer than the last approved one on its own channel", async () => {
    const { appId, token } = await publisherWithApp()
    const stable = bytesOf("the stable build")
    const approved = await publish(token, appId, stable)
    await uploadAndComplete(approved, stable)
    await approve(approved.release, "Reviewer")

    const older = bytesOf("an older build")
    const backwards = await uploadAndComplete(await publish(token, appId, older, { version: "0.9.0" }), older)
    expect(versionCheck(backwards)?.status).toBe("failed")

    const nightly = bytesOf("a nightly build")
    const started = await publish(token, appId, nightly, { version: "0.1.0-nightly.202611030415.g1a2b3c4" })
    expect(started.channel).toBe("nightly")
    expect(versionCheck(await uploadAndComplete(started, nightly))?.status).toBe("passed")
  })
})

describe("a listing.toml sent with a release", () => {
  const listingToml = (summary: string, categories: string[]) =>
    `summary = "${summary}"\ncategories = ${JSON.stringify(categories)}\nbrand_color = "#3e6b4f"\n`

  test("sets the listing, but leaves what was changed in the dashboard", async () => {
    const { appId, token } = await publisherWithApp()
    const file = bytesOf("#!/bin/sh\n")
    await publish(token, appId, file, {
      listingToml: listingToml("From the repository", ["Office", "Utility"]),
    })

    const row = await env.DB.prepare(
      "SELECT categories, brand_color, m.sources AS meta, summary, l.sources AS words FROM listing_meta m JOIN listing l USING (app_id) WHERE app_id = ?",
    )
      .bind(appId)
      .first<Record<string, string>>()
    expect(JSON.parse(row!.categories!)).toEqual(["Office", "Utility"])
    expect(row!.brand_color).toBe("#3e6b4f")
    expect(row!.summary).toBe("From the repository")
    expect(JSON.parse(row!.words!).summary).toBe("listing")

    await env.DB.batch([
      env.DB.prepare("UPDATE listing_meta SET categories = ?, sources = ? WHERE app_id = ?").bind(
        JSON.stringify(["Utility", "Office"]),
        JSON.stringify({ ...JSON.parse(row!.meta!), categories: "dashboard" }),
        appId,
      ),
    ])
    await publish(token, appId, file, {
      version: "1.0.1",
      listingToml: listingToml("Changed again", ["Game"]),
    })
    const after = await env.DB.prepare(
      "SELECT categories, summary FROM listing_meta JOIN listing USING (app_id) WHERE app_id = ?",
    )
      .bind(appId)
      .first<Record<string, string>>()
    expect(JSON.parse(after!.categories!)).toEqual(["Utility", "Office"])
    expect(after!.summary).toBe("Changed again")
  })

  test("that doesn't parse is refused before anything is uploaded", async () => {
    const { appId, token } = await publisherWithApp()
    const response = await start(token, appId, bytesOf("#!/bin/sh\n"), { listingToml: "brand_color = 3" })
    expect(response.status).toBe(422)
  })
})

describe("promoting from a release pipeline", () => {
  function promote(token: string, appId: string, version: string) {
    return exports.default.fetch(
      new Request(`${API}/publish/apps/${appId}/promote`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          version,
          channel: "stable",
          notes: "Everything since the last stable release",
        }),
      }),
    )
  }

  test("a nightly that's out goes to stable once, keeping its files, and shows in the app's releases", async () => {
    const { appId, token } = await publisherWithApp()
    const file = bytesOf("tonight's build")
    const nightly = await publish(token, appId, file, { version: "1.0.1", channel: "nightly" })
    await uploadAndComplete(nightly, file)
    await approve(nightly.release, "Reviewer")

    const first = await promote(token, appId, "1.0.1")
    expect(first.status).toBe(201)
    const promoted = (await first.json()) as PublishedRelease
    expect(promoted).toMatchObject({ version: "1.0.1", channel: "stable", status: "in-review" })
    const again = (await (await promote(token, appId, "1.0.1")).json()) as PublishedRelease
    expect(again.release).toBe(promoted.release)

    const listed = await exports.default.fetch(
      new Request(`${API}/publish/apps/${appId}/releases`, { headers: { authorization: `Bearer ${token}` } }),
    )
    const { releases } = (await listed.json()) as PublishedReleases
    expect(releases.map((release) => [release.channel, release.status])).toEqual([
      ["stable", "in-review"],
      ["nightly", "rolling-out"],
    ])
  })

  test("a version that isn't out anywhere can't be promoted", async () => {
    const { appId, token } = await publisherWithApp()
    const file = bytesOf("a build still waiting")
    await uploadAndComplete(await publish(token, appId, file, { version: "1.0.1", channel: "nightly" }), file)
    expect((await promote(token, appId, "1.0.1")).status).toBe(409)
  })
})
