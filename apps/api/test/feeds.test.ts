import { env } from "cloudflare:workers"
import { importSigningKey, paths, type SabineFeed, verifySabineFeed } from "@schelf/protocol"
import { describe, expect, test } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { randomId } from "../src/lib/ids.ts"
import { rebuildApp } from "../src/signing/rebuild.ts"
import { developerWithApp } from "./fixtures.ts"

async function sabineRelease(appId: string, version: string, percent: number, approvedAt: Date) {
  const id = randomId()
  await db.insert(schema.release).values({
    id,
    appId,
    version,
    origin: "oidc",
    manifest: "",
    requires: { sabine: "0.68" },
    status: percent === 100 ? "live" : "rolling-out",
    rolloutPercent: percent,
    approvedAt,
  })
  await db.insert(schema.artifact).values([
    {
      id: randomId(),
      releaseId: id,
      name: "notes-windows.zip",
      platform: "windows-x86_64",
      format: "sabine",
      kind: "archive",
      key: paths.artifact(appId, version, "windows-x86_64", "notes-windows.zip"),
      size: 10,
      sha256: "b".repeat(64),
      executable: "Notes.exe",
    },
    {
      id: randomId(),
      releaseId: id,
      name: "notes.msi",
      platform: "windows-x86_64",
      format: "sabine",
      kind: "msi",
      key: paths.artifact(appId, version, "windows-x86_64", "notes.msi"),
      size: 10,
      sha256: "c".repeat(64),
    },
  ])
}

describe("Sabine update feeds", () => {
  test("follow the newest release that reached everyone, signed so Sabine accepts it", async () => {
    const { appId } = await developerWithApp("sabine")
    await db.update(schema.app).set({ status: "listed" })
    await sabineRelease(appId, "1.0.0", 100, new Date("2026-10-01T00:00:00Z"))
    await sabineRelease(appId, "1.1.0", 25, new Date("2026-11-01T00:00:00Z"))
    await rebuildApp(appId)

    const feed = await env.BUCKET.get(paths.sabine(appId, "stable")).then((object) =>
      object!.json<SabineFeed>(),
    )
    expect(feed.version).toBe("1.0.0")
    expect(feed.requires_sabine).toEqual({ major: 0, build: 68 })
    expect(Object.keys(feed.artifacts).sort()).toEqual(["windows-x86_64", "windows-x86_64-msi"])
    expect(feed.artifacts["windows-x86_64"]!.executable).toBe("Notes.exe")
    const key = await importSigningKey(env.STORE_SIGNING_KEY)
    expect(await verifySabineFeed(key.publicKey, feed)).toBe(true)
  })
})
