import { env, exports } from "cloudflare:workers"
import {
  type ApplyResponse,
  type CreatedChannelToken,
  type InvitedChannel,
  type InvitedDownloads,
  paths,
  sha256Hex,
} from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { bytesOf, json, person, publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"
const DL = "https://dl.schelf.store"
const BETA = `\n[channels.beta]\ninvite_only = true\n`

function call(token: string, path: string, init: RequestInit = {}, base = API) {
  return exports.default.fetch(
    new Request(`${base}${path}`, {
      ...init,
      redirect: "manual",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    }),
  )
}

const schelf = (appId: string, extra = BETA) => `id = "${appId}"\nformat = "files"\n${extra}`

async function project() {
  const created = await publisherWithApp("files")
  await db
    .update(schema.app)
    .set({ status: "published", visibility: "unlisted" })
    .where(eq(schema.app.id, created.appId))
  const applied = await call(created.token, "/apply", {
    method: "POST",
    body: JSON.stringify({ schelf_toml: schelf(created.appId) }),
  })
  expect(((await applied.json()) as ApplyResponse).applied).toBe(true)
  return created
}

async function shipOnBeta(appId: string) {
  const id = randomId()
  const key = paths.invitedArtifact(appId, "2.0.0-beta.1", "windows-x86_64", "notes.exe")
  await env.BUCKET.put(key, bytesOf("an early build"))
  await db.insert(schema.release).values({
    id,
    appId,
    version: "2.0.0-beta.1",
    channel: "beta",
    origin: "oidc",
    format: "files",
    manifest: "",
    requires: {},
    status: "live",
    rolloutPercent: 100,
    approvedAt: new Date(),
  })
  await db.insert(schema.artifact).values({
    id: randomId(),
    releaseId: id,
    name: "notes.exe",
    platform: "windows-x86_64",
    format: "files",
    kind: "exe",
    key,
    size: 14,
    sha256: "b".repeat(64),
  })
  return key
}

describe("an invite-only channel", () => {
  test("keeps its files under invited/ from the first upload", async () => {
    const { appId, token } = await project()
    const file = bytesOf("an early build")
    const started = await call(token, "/publish", {
      method: "POST",
      body: JSON.stringify({
        version: "2.0.0-beta.1",
        channel: "beta",
        schelf_toml: schelf(appId),
        files: [
          {
            name: "notes.exe",
            platform: "windows-x86_64",
            kind: "exe",
            size: file.length,
            sha256: await sha256Hex(file),
          },
        ],
      }),
    })
    const { release } = (await started.json()) as { release: string }
    const artifact = await db.query.artifact.findFirst({ where: eq(schema.artifact.releaseId, release) })
    expect(artifact?.key.startsWith("invited/apps/")).toBe(true)
  })

  test("asks for a sign-in without one, refuses the uninvited, and lets a token or an invited person in", async () => {
    const { appId, publisherSlug, userId } = await project()
    const key = await shipOnBeta(appId)
    expect((await exports.default.fetch(`${DL}/${publisherSlug}/notes/@beta/latest/windows`)).status).toBe(
      401,
    )
    expect((await exports.default.fetch(`${DL}/${key}`)).status).toBe(401)

    const owner = await person("Mira", userId)
    const made = await json<CreatedChannelToken>(
      await owner.call("POST", `/apps/${appId}/channels/beta/tokens`, { name: "ci" }),
    )
    const link = await call(made.token, `/${publisherSlug}/notes/@beta/latest/windows`, {}, DL)
    expect(link.status).toBe(302)
    expect(link.headers.get("cache-control")).toBe("no-store")
    const signed = await exports.default.fetch(link.headers.get("location")!)
    expect(signed.status).toBe(200)
    expect(await signed.text()).toBe("an early build")

    const tester = await person("Ada")
    expect((await call(tester.token, `/${key}`, {}, DL)).status).toBe(403)
    expect((await call("schelfdl_unknown", `/${key}`, {}, DL)).status).toBe(401)
    await owner.call("POST", `/apps/${appId}/channels/beta/invites`, { email: tester.email })
    const file = await call(tester.token, `/${key}`, {}, DL)
    expect(file.status).toBe(200)
    await file.body?.cancel()

    const invited = await json<InvitedChannel[]>(await call(tester.token, "/invited"))
    expect(invited.map((entry) => [entry.app, entry.channel])).toEqual([[appId, "beta"]])
    const downloads = await json<InvitedDownloads[]>(
      await call(tester.token, `/invited/projects/${publisherSlug}/notes`),
    )
    expect(downloads[0]?.files[0]?.url).toContain("access=")
  })

  test("stays out of the public index, and gets a signed index of its own", async () => {
    const { appId } = await project()
    await shipOnBeta(appId)
    await rebuildApp(appId)
    const index = (await (await env.BUCKET.get(paths.app(appId)))!.json()) as { releases: unknown[] }
    expect(index.releases).toEqual([])
    const invited = (await (await env.BUCKET.get(paths.invitedApp(appId, "beta")))!.json()) as {
      releases: { version: string }[]
    }
    expect(invited.releases.map((release) => release.version)).toEqual(["2.0.0-beta.1"])
  })

  test("can only start before anyone could download from the channel", async () => {
    const { appId, token } = await publisherWithApp("files")
    await call(token, "/apply", { method: "POST", body: JSON.stringify({ schelf_toml: schelf(appId, "") }) })
    await shipOnBeta(appId)
    const refused = await call(token, "/apply", {
      method: "POST",
      body: JSON.stringify({ schelf_toml: schelf(appId) }),
    })
    expect(refused.status).toBe(422)
  })

  test("asks a person in the browser before the schelf command invites anyone", async () => {
    const { appId, userId } = await project()
    const cli = await person("Mira", userId, "cli")
    const asked = await cli.call("POST", `/apps/${appId}/channels/beta/invites`, { email: "ada@example.com" })
    expect(asked.status).toBe(403)
  })

  test("keeps the Schelf app signed in for as long as it's used", async () => {
    const tester = await person("Ada", undefined, "app")
    await db
      .update(schema.session)
      .set({ expiresAt: new Date(Date.now() + 86_400_000) })
      .where(eq(schema.session.token, tester.token))
    expect((await call(tester.token, "/invited")).status).toBe(200)
    const session = await db.query.session.findFirst({ where: eq(schema.session.token, tester.token) })
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * 86_400_000)
  })
})
