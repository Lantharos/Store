import { exports } from "cloudflare:workers"
import {
  type CheckName,
  type CheckStatus,
  type CompleteResponse,
  type ProjectDownloads,
  type PublishResponse,
  paths,
  sha256Hex,
} from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { describe, expect, test, vi } from "vitest"
import { db, schema } from "../src/db/client.ts"
import { reviewRoute } from "../src/hosting/scrutiny.ts"
import { randomId } from "../src/lib/ids.ts"
import { bytesOf, publisherWithApp } from "./fixtures.ts"

const API = "https://schelf.store/api/v1"
const DL = "https://dl.schelf.store"
type Check = { name: CheckName; status: CheckStatus }
const CLEAN: Check[] = (
  ["namespace", "version", "platforms", "files", "attestation", "malware", "inspection"] as const
).map((name) => ({ name, status: "passed" }))

describe("who reviews a release", () => {
  test("an unlisted project from Actions goes out on its checks alone", () => {
    expect(reviewRoute({ origin: "oidc", visibility: "unlisted", channel: "stable", checks: CLEAN })).toEqual(
      {
        route: "automatic",
      },
    )
  })

  test("a check that flags something brings in a person", () => {
    const flagged: Check[] = [
      ...CLEAN.filter((check) => check.name !== "malware"),
      { name: "malware", status: "warning" },
    ]
    expect(
      reviewRoute({ origin: "oidc", visibility: "unlisted", channel: "stable", checks: flagged }).route,
    ).toBe("review")
  })

  test("an incomplete listing or a missing licence doesn't hold an unlisted project back", () => {
    const checks: Check[] = [
      ...CLEAN,
      { name: "listing", status: "warning" },
      { name: "licence", status: "warning" },
    ]
    expect(reviewRoute({ origin: "oidc", visibility: "unlisted", channel: "stable", checks }).route).toBe(
      "automatic",
    )
  })

  test("without the malware scan, a person looks", () => {
    const checks = CLEAN.filter((check) => check.name !== "malware")
    expect(reviewRoute({ origin: "oidc", visibility: "unlisted", channel: "stable", checks }).route).toBe(
      "review",
    )
  })

  test("uploads by hand are always reviewed", () => {
    expect(
      reviewRoute({ origin: "manual", visibility: "unlisted", channel: "nightly", checks: CLEAN }).route,
    ).toBe("review")
  })

  test("listed projects are reviewed on stable and beta, and nightlies go on their checks", () => {
    expect(
      reviewRoute({ origin: "oidc", visibility: "listed", channel: "stable", checks: CLEAN }).route,
    ).toBe("review")
    expect(reviewRoute({ origin: "oidc", visibility: "listed", channel: "beta", checks: CLEAN }).route).toBe(
      "review",
    )
    expect(
      reviewRoute({ origin: "oidc", visibility: "listed", channel: "nightly", checks: CLEAN }).route,
    ).toBe("automatic")
  })
})

async function project() {
  const created = await publisherWithApp("files")
  await db
    .update(schema.app)
    .set({ status: "published", visibility: "unlisted", updater: "electron" })
    .where(eq(schema.app.id, created.appId))
  return created
}

async function shipped(
  appId: string,
  version: string,
  percent: number,
  approvedAt: string,
  files: [string, string, string][],
) {
  const id = randomId()
  await db.insert(schema.release).values({
    id,
    appId,
    version,
    origin: "oidc",
    format: "files",
    updater: "electron",
    manifest: "",
    requires: {},
    status: percent === 100 ? "live" : "rolling-out",
    rolloutPercent: percent,
    approvedAt: new Date(approvedAt),
  })
  await db.insert(schema.artifact).values(
    files.map(([name, platform, kind]) => ({
      id: randomId(),
      releaseId: id,
      name,
      platform,
      format: "files",
      kind,
      key: paths.artifact(appId, version, platform, name),
      size: 10,
      sha256: "b".repeat(64),
      sha512: "c2hh",
    })),
  )
}

const fetchDl = (path: string, headers: Record<string, string> = {}) =>
  exports.default.fetch(new Request(`${DL}/${path}`, { headers, redirect: "manual" }))

describe("stable download links", () => {
  test("point at the newest release that reached everyone, and follow the rollout when asked", async () => {
    const { appId, publisherSlug } = await project()
    await shipped(appId, "1.0.0", 100, "2026-10-01T00:00:00Z", [["notes-1.0.0.exe", "windows-x86_64", "exe"]])
    await shipped(appId, "1.1.0", 25, "2026-11-01T00:00:00Z", [["notes-1.1.0.exe", "windows-x86_64", "exe"]])

    const windows = await fetchDl(`${publisherSlug}/notes/latest/windows`)
    expect(windows.status).toBe(302)
    expect(windows.headers.get("location")).toBe(
      `${DL}/${paths.artifact(appId, "1.0.0", "windows-x86_64", "notes-1.0.0.exe")}`,
    )

    const visitor = await fetchDl(`${publisherSlug}/notes/latest`, {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    })
    expect(visitor.headers.get("location")).toContain("notes-1.0.0.exe")

    await db.update(schema.app).set({ latestFollowsRollout: true }).where(eq(schema.app.id, appId))
    const draw = vi.spyOn(Math, "random").mockReturnValue(0.1)
    const early = await fetchDl(`${publisherSlug}/notes/latest/windows`)
    draw.mockRestore()
    expect(early.headers.get("location")).toContain("notes-1.1.0.exe")
    expect(early.headers.get("cache-control")).toBe("no-store")
  })

  test("describe the release as JSON and as electron-updater's latest.yml", async () => {
    const { appId, publisherSlug } = await project()
    await shipped(appId, "2.0.0", 100, "2026-11-01T00:00:00Z", [
      ["notes-2.0.0.exe", "windows-x86_64", "exe"],
      ["notes-2.0.0.dmg", "macos-universal", "dmg"],
    ])
    const latest = (await (await fetchDl(`${publisherSlug}/notes/latest.json`)).json()) as ProjectDownloads
    expect(latest.version).toBe("2.0.0")
    expect(latest.files.map((file) => file.link).sort()).toEqual([
      `${DL}/${publisherSlug}/notes/latest/macos-universal/dmg`,
      `${DL}/${publisherSlug}/notes/latest/windows-x86_64/exe`,
    ])
    const yml = await (await fetchDl(`${publisherSlug}/notes/latest.yml`)).text()
    expect(yml).toContain('version: "2.0.0"')
    expect(yml).toContain("notes-2.0.0.exe")
    expect((await fetchDl(`${publisherSlug}/notes/latest/linux`)).status).toBe(404)
  })
})

describe("uploading by hand", () => {
  test("goes to a person even for an unlisted project", async () => {
    const { appId, token } = await project()
    const file = bytesOf("a Windows installer")
    const started = (await (
      await exports.default.fetch(
        new Request(`${API}/publish`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            version: "1.0.0",
            schelf_toml: `id = "${appId}"\nformat = "files"\n`,
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
        }),
      )
    ).json()) as PublishResponse
    await exports.default.fetch(
      new Request(started.files[0]!.url, {
        method: "PUT",
        headers: { authorization: `Bearer ${started.upload_token}`, "content-length": String(file.length) },
        body: file,
      }),
    )
    const completed = (await (
      await exports.default.fetch(
        new Request(`${API}/publish/${started.release}/complete`, {
          method: "POST",
          headers: { authorization: `Bearer ${started.upload_token}` },
        }),
      )
    ).json()) as CompleteResponse
    expect(completed.status).toBe("in-review")
    const artifact = await db.query.artifact.findFirst({
      where: eq(schema.artifact.releaseId, started.release),
    })
    expect(artifact?.sha512).toBeTruthy()
  })
})
