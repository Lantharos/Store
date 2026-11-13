import { env, exports } from "cloudflare:workers"
import {
  type AppPage,
  type PublisherTool,
  paths,
  sha256Hex,
  type ToolIndex,
  trustedStoreKeys,
  verifyDocument,
} from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { revoke } from "../src/verification/decisions.ts"
import { bytesOf, json, person, publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"
const SABINE = {
  files: ["sabine-cli-*"],
  platforms: ["linux-x86_64" as const, "macos-aarch64" as const],
  tool: "sabine",
}

async function toolProject() {
  const created = await publisherWithApp("files")
  await db
    .update(schema.app)
    .set({
      status: "published",
      visibility: "unlisted",
      platforms: ["windows-x86_64"],
      parts: { cli: SABINE },
    })
    .where(eq(schema.app.id, created.appId))
  return created
}

async function shipped(appId: string, version: string, channel = "stable") {
  const id = randomId()
  await db.insert(schema.release).values({
    id,
    appId,
    version,
    channel,
    origin: "oidc",
    format: "files",
    manifest: "",
    requires: {},
    status: "live",
    rolloutPercent: 100,
    approvedAt: new Date(),
  })
  const files: [string, string | null, string, string][] = [
    ["notes.exe", null, "windows-x86_64", "exe"],
    ["sabine-cli-linux-x86_64", "cli", "linux-x86_64", "binary"],
    ["sabine-cli-macos-aarch64.tar.gz", "cli", "macos-aarch64", "tarball"],
  ]
  await db.insert(schema.artifact).values(
    files.map(([name, part, platform, kind]) => ({
      id: randomId(),
      releaseId: id,
      name,
      part,
      platform,
      format: "files",
      kind,
      key: paths.artifact(appId, version, platform, name),
      size: 10,
      sha256: "b".repeat(64),
    })),
  )
}

async function signed(key: string) {
  const [body, signature, keys] = await Promise.all(
    [key, paths.signature(key), paths.storeKeys, paths.signature(paths.storeKeys)].map(async (each) =>
      (await env.BUCKET.get(each))?.text(),
    ),
  ).then(async ([body, signature, storeKeys, storeKeysSignature]) => [
    body,
    signature,
    await trustedStoreKeys(env.ROOT_PUBLIC_KEY, storeKeys!, JSON.parse(storeKeysSignature!)),
  ])
  if (!body) return null
  expect(
    await verifyDocument(keys as Map<string, string>, body as string, JSON.parse(signature as string)),
  ).toBe(true)
  return JSON.parse(body as string) as ToolIndex
}

const verify = (publisherId: string) =>
  db.update(schema.publisher).set({ verifiedAt: new Date() }).where(eq(schema.publisher.id, publisherId))

describe("the signed index of a tool", () => {
  test("names the tool's own files per system at publisher/name, stamped with its path", async () => {
    const { appId, publisherSlug } = await toolProject()
    await shipped(appId, "1.0.0")
    await rebuildApp(appId)
    const index = (await signed(paths.tool(publisherSlug, "sabine")))!
    expect(index.path).toBe(paths.tool(publisherSlug, "sabine"))
    expect(index.address).toBe(`${publisherSlug}/sabine`)
    expect(index.short).toBe(false)
    expect(index.project).toEqual({ id: appId, address: `${publisherSlug}/notes`, part: "cli" })
    expect(index.publisher.verified).toBe(false)
    expect(index.releases[0]!.files.map((file) => [file.platform, file.kind])).toEqual([
      ["linux-x86_64", "binary"],
      ["macos-aarch64", "tarball"],
    ])
    expect(await env.BUCKET.get(paths.shortTool("sabine"))).toBeNull()
  })

  test("answers to its bare name only while its publisher is verified", async () => {
    const { appId, publisherId, publisherSlug, userId } = await toolProject()
    const name = `notes-${randomId(6).toLowerCase()}`
    await db
      .update(schema.app)
      .set({ parts: { cli: { ...SABINE, tool: name } } })
      .where(eq(schema.app.id, appId))
    await shipped(appId, "1.0.0")
    const owner = await person("Mira", userId)

    const unverified = await owner.call("POST", `/publishers/${publisherId}/tool-names`, { name })
    expect(unverified.status).toBe(403)

    await verify(publisherId)
    const claimed = await json<PublisherTool[]>(
      await owner.call("POST", `/publishers/${publisherId}/tool-names`, { name }),
    )
    expect(claimed[0]).toMatchObject({ short: "resolves", add: `sch add ${name}` })
    await rebuildApp(appId)
    expect((await signed(paths.shortTool(name)))!.address).toBe(`${publisherSlug}/${name}`)

    await db.insert(schema.publisherVerification).values({
      id: randomId(),
      publisherId,
      status: "approved",
      proofToken: "proof",
    })
    await revoke(publisherId, "Reviewer", "Gone")
    await rebuildApp(appId)
    expect(await env.BUCKET.get(paths.shortTool(name))).toBeNull()
    expect((await signed(paths.tool(publisherSlug, name)))!.short).toBe(false)
    const page = await json<AppPage>(
      await exports.default.fetch(new Request(`${API}/projects/${publisherSlug}/notes`)),
    )
    expect(page.tools).toEqual([
      expect.objectContaining({ short: "paused", add: `sch add ${publisherSlug}/${name}` }),
    ])
  })

  test("a reserved or taken bare name can't be claimed", async () => {
    const first = await toolProject()
    const second = await toolProject()
    const name = `notes-${randomId(6).toLowerCase()}`
    for (const { appId, publisherId } of [first, second]) {
      await verify(publisherId)
      await db
        .update(schema.app)
        .set({ parts: { cli: { ...SABINE, tool: name }, git: { ...SABINE, files: ["git-*"], tool: "git" } } })
        .where(eq(schema.app.id, appId))
    }
    const mira = await person("Mira", first.userId)
    const other = await person("Mira", second.userId)
    expect(
      (await mira.call("POST", `/publishers/${first.publisherId}/tool-names`, { name: "git" })).status,
    ).toBe(409)
    expect((await mira.call("POST", `/publishers/${first.publisherId}/tool-names`, { name })).status).toBe(
      201,
    )
    expect((await other.call("POST", `/publishers/${second.publisherId}/tool-names`, { name })).status).toBe(
      409,
    )
  })

  test("claiming from the command line asks in the browser first", async () => {
    const { publisherId, userId } = await toolProject()
    await verify(publisherId)
    const cli = await person("Mira", userId, "cli")
    const response = await cli.call("POST", `/publishers/${publisherId}/tool-names`, { name: "sabine" })
    expect(response.status).toBe(403)
  })
})

describe("publishing a tool", () => {
  async function publish(token: string, appId: string, names: [string, string, string][]) {
    const file = bytesOf("a build")
    return exports.default.fetch(
      new Request(`${API}/publish`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          version: "1.0.0",
          schelf_toml: `id = "${appId}"\nformat = "files"\n`,
          files: await Promise.all(
            names.map(async ([name, platform, kind]) => ({
              name,
              platform,
              kind,
              size: file.length,
              sha256: await sha256Hex(file),
            })),
          ),
        }),
      }),
    )
  }

  test("takes one program per system, never an installer or two files", async () => {
    const { appId, token } = await toolProject()
    const app = ["notes.exe", "windows-x86_64", "exe"] as [string, string, string]
    const mac = ["sabine-cli-macos-aarch64.zip", "macos-aarch64", "zip"] as [string, string, string]
    const twice = await publish(token, appId, [
      app,
      mac,
      ["sabine-cli-linux-x86_64", "linux-x86_64", "binary"],
      ["sabine-cli-linux-x86_64.tar.gz", "linux-x86_64", "tarball"],
    ])
    expect(((await twice.json()) as { error: string }).error).toContain("one file for each system")
    const installer = await publish(token, appId, [app, mac, ["sabine-cli-linux.deb", "linux-x86_64", "deb"]])
    expect(((await installer.json()) as { error: string }).error).toContain("is a deb")
    const fine = await publish(token, appId, [
      app,
      mac,
      ["sabine-cli-linux-x86_64", "linux-x86_64", "binary"],
    ])
    expect(fine.status).toBe(201)
  })
})

describe("the install script", () => {
  async function storeTool() {
    const created = await toolProject()
    await db
      .update(schema.publisher)
      .set({ slug: "lantharos" })
      .where(eq(schema.publisher.id, created.publisherId))
    await db
      .update(schema.app)
      .set({ parts: { cli: { ...SABINE, tool: "schelf" } } })
      .where(eq(schema.app.id, created.appId))
    await shipped(created.appId, "1.0.0", "nightly")
    await rebuildApp(created.appId)
    return created
  }

  const install = (path: string) => exports.default.fetch(new Request(`https://schelf.store${path}`))

  test("bakes in the file and SHA-256 for each system, and adds the tool it was asked for", async () => {
    await storeTool()
    expect((await install("/install")).status).toBe(503)
    const script = await (await install("/install?channel=nightly")).text()
    expect(script).toContain("linux-x86_64) set -- 'https://dl.schelf.store/apps/")
    expect(script).toContain(`'${"b".repeat(64)}' 'tarball' 10 ;;`)
    expect(script).not.toContain("schelf add")
    const adding = await (await install(`/install/lantharos/schelf?channel=nightly`)).text()
    expect(adding).toContain(`"$bin/schelf" add 'lantharos/schelf'`)
    expect((await install(`/install/lantharos/nothing?channel=nightly`)).status).toBe(404)
  })
})
