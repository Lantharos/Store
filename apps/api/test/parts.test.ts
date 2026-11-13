import { env, exports } from "cloudflare:workers"
import { type ProjectDownloads, paths, sha256Hex } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { bytesOf, publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"
const DL = "https://dl.schelf.store"
const CLI = { cli: { files: ["notes-cli-*"], platforms: ["linux-x86_64" as const] } }

async function project() {
  const created = await publisherWithApp("files")
  await db
    .update(schema.app)
    .set({ status: "published", visibility: "unlisted", platforms: ["windows-x86_64"], parts: CLI })
    .where(eq(schema.app.id, created.appId))
  return created
}

async function shipped(appId: string, version: string, files: [string, string | null, string][]) {
  const id = randomId()
  await db.insert(schema.release).values({
    id,
    appId,
    version,
    origin: "oidc",
    format: "files",
    manifest: "",
    requires: {},
    status: "live",
    rolloutPercent: 100,
    approvedAt: new Date(),
  })
  await db.insert(schema.artifact).values(
    files.map(([name, part, platform]) => ({
      id: randomId(),
      releaseId: id,
      name,
      part,
      platform,
      format: "files",
      kind: name.endsWith(".exe") ? "exe" : name.endsWith(".deb") ? "deb" : "tarball",
      key: paths.artifact(appId, version, platform, name),
      size: 10,
      sha256: "b".repeat(64),
      sha512: "c2hh",
    })),
  )
}

const fetchDl = (path: string) => exports.default.fetch(new Request(`${DL}/${path}`, { redirect: "manual" }))

async function publish(appId: string, token: string, names: [string, string][]) {
  const file = bytesOf("a build")
  return exports.default.fetch(
    new Request(`${API}/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        version: "1.0.0",
        schelf_toml: `id = "${appId}"\nformat = "files"\n`,
        files: await Promise.all(
          names.map(async ([name, platform]) => ({
            name,
            platform,
            kind: name.endsWith(".exe") ? "exe" : "tarball",
            size: file.length,
            sha256: await sha256Hex(file),
          })),
        ),
      }),
    }),
  )
}

describe("publishing parts", () => {
  test("a release without every system schelf.toml names is refused", async () => {
    const { appId, token } = await project()
    const refused = await publish(appId, token, [["notes.exe", "windows-x86_64"]])
    expect(refused.status).toBe(422)
    expect(((await refused.json()) as { error: string }).error).toContain("linux-x86_64 in cli")
  })

  test("files join their part by name", async () => {
    const { appId, token } = await project()
    const started = await publish(appId, token, [
      ["notes.exe", "windows-x86_64"],
      ["notes-cli-linux.tar.gz", "linux-x86_64"],
    ])
    expect(started.status).toBe(201)
    const { release } = (await started.json()) as { release: string }
    const artifacts = await db.select().from(schema.artifact).where(eq(schema.artifact.releaseId, release))
    expect(Object.fromEntries(artifacts.map((artifact) => [artifact.name, artifact.part]))).toEqual({
      "notes.exe": null,
      "notes-cli-linux.tar.gz": "cli",
    })
  })
})

describe("links to parts", () => {
  test("live under the part, and are in latest.json beside the app's", async () => {
    const { appId, publisherSlug } = await project()
    await shipped(appId, "1.0.0", [
      ["notes.exe", null, "windows-x86_64"],
      ["notes-cli-linux.tar.gz", "cli", "linux-x86_64"],
    ])
    const cli = await fetchDl(`${publisherSlug}/notes/latest/cli/linux-x86_64`)
    expect(cli.headers.get("location")).toContain("notes-cli-linux.tar.gz")
    expect((await fetchDl(`${publisherSlug}/notes/latest/linux-x86_64`)).status).toBe(404)
    const latest = (await (await fetchDl(`${publisherSlug}/notes/latest.json`)).json()) as ProjectDownloads
    expect(latest.files.map((file) => [file.part, file.link.split("/latest/")[1]]).sort()).toEqual([
      [null, "windows-x86_64/exe"],
      ["cli", "cli/linux-x86_64/tarball"],
    ])
  })

  test("end when their system leaves schelf.toml, and stay reachable by version", async () => {
    const { appId, publisherSlug } = await project()
    await shipped(appId, "1.0.0", [
      ["notes.exe", null, "windows-x86_64"],
      ["notes-cli-linux.tar.gz", "cli", "linux-x86_64"],
    ])
    await db.update(schema.app).set({ parts: {} }).where(eq(schema.app.id, appId))
    expect((await fetchDl(`${publisherSlug}/notes/latest/cli/linux-x86_64`)).status).toBe(404)
    const sums = await (await fetchDl(`${publisherSlug}/notes/latest/SHA256SUMS`)).text()
    expect(sums).not.toContain("notes-cli")
    const pinned = await fetchDl(`${publisherSlug}/notes/v/1.0.0/cli/linux-x86_64`)
    expect(pinned.headers.get("location")).toContain("notes-cli-linux.tar.gz")
  })
})

describe("update feeds of parts", () => {
  test("live under the part and name it, and a Sabine part gets a signed feed of its own", async () => {
    const { appId, publisherSlug } = await project()
    await db
      .update(schema.app)
      .set({
        parts: {
          cli: { files: ["notes-cli-*"], platforms: ["windows-x86_64"], updater: "electron" },
          helper: {
            files: ["helper-*"],
            platforms: ["linux-x86_64"],
            format: "sabine",
            id: "com.example.Helper",
          },
        },
      })
      .where(eq(schema.app.id, appId))
    await shipped(appId, "1.0.0", [
      ["notes.exe", null, "windows-x86_64"],
      ["notes-cli-1.0.0.exe", "cli", "windows-x86_64"],
      ["helper-linux-x86_64-deb.deb", "helper", "linux-x86_64"],
    ])
    const yml = await (await fetchDl(`${publisherSlug}/notes/latest/cli/latest.yml`)).text()
    expect(yml).toContain('part: "cli"')
    expect(yml).toContain("notes-cli-1.0.0.exe")
    expect(yml).not.toContain("notes.exe")

    await rebuildApp(appId)
    const feed = (await (await env.BUCKET.get(paths.sabinePart(appId, "helper", "stable")))!.json()) as {
      app_id: string
      artifacts: Record<string, { url: string }>
    }
    expect(feed.app_id).toBe("com.example.Helper")
    expect(Object.keys(feed.artifacts)).toEqual(["linux-x86_64-deb"])
    expect(await env.BUCKET.get(paths.sabine(appId, "stable"))).toBeNull()
  })
})
