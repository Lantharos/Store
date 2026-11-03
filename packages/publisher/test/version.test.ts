import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { compareVersions } from "@schelf/protocol"
import { releaseVersion } from "../src/index.ts"

const COMMIT = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"
const AT = new Date("2026-11-03T04:15:30Z")

let folder: string

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "schelf-version-"))
})

afterEach(() => rm(folder, { recursive: true }))

test("the version comes from the app's own manifest", async () => {
  await writeFile(
    join(folder, "Sabine.toml"),
    '[app]\nid = "io.github.alice.Notes"\nname = "Notes"\nversion = "1.4.0"\n',
  )
  expect(await releaseVersion({ folder, format: "sabine" })).toBe("1.4.0")

  await writeFile(
    join(folder, "extension.toml"),
    'id = "com.lantharos.Rain"\nversion = "2.0.0-beta.1"\napi = 1\n',
  )
  expect(await releaseVersion({ folder, format: "luft-extension" })).toBe("2.0.0-beta.1")

  await writeFile(join(folder, "package.json"), '{ "version": "0.3.0" }')
  expect(await releaseVersion({ folder, format: "appimage" })).toBe("0.3.0")
  await mkdir(join(folder, "src-tauri"))
  await writeFile(join(folder, "src-tauri", "tauri.conf.json"), '{ "version": "0.4.0" }')
  expect(await releaseVersion({ folder, format: "appimage" })).toBe("0.4.0")
})

test("a tag or an explicit version wins over the manifest", async () => {
  await writeFile(join(folder, "Sabine.toml"), '[app]\nversion = "1.4.0"\n')
  expect(await releaseVersion({ folder, format: "sabine", tag: "notes/v1.5.0" })).toBe("1.5.0")
  expect(await releaseVersion({ folder, format: "sabine", tag: "notes/v1.5.0", version: "v1.6.0" })).toBe(
    "1.6.0",
  )
})

test("a manifest without a version is explained", async () => {
  await writeFile(join(folder, "Sabine.toml"), '[app]\nid = "io.github.alice.Notes"\n')
  await expect(releaseVersion({ folder, format: "sabine" })).rejects.toThrow("No version in Sabine.toml")
})

test("nightlies get a version of their own that's newer than the release they follow", async () => {
  await writeFile(join(folder, "Sabine.toml"), '[app]\nversion = "0.1.0"\n')
  const nightly = await releaseVersion({ folder, format: "sabine", channel: "nightly", commit: COMMIT }, AT)
  expect(nightly).toBe("0.2.0-nightly.202611030415.g1a2b3c4")
  expect(compareVersions(nightly, "0.1.0")).toBe(1)

  const later = await releaseVersion(
    { folder, format: "sabine", channel: "nightly", commit: "0".repeat(40) },
    new Date("2026-11-03T09:00:00Z"),
  )
  expect(compareVersions(later, nightly)).toBe(1)
  expect(compareVersions(later, "0.2.0")).toBe(-1)
  expect(await releaseVersion({ folder, format: "sabine", channel: "beta", commit: COMMIT }, AT)).toBe(
    "0.1.0",
  )
})
