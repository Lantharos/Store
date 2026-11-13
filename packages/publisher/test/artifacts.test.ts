import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { deflateRawSync } from "node:zlib"
import { collectArtifacts, inferArtifact } from "../src/index.ts"

let root: string

const embeddedBlockmap = () => deflateRawSync(JSON.stringify({ version: "2", files: [] }))

function elf(machine: number) {
  const header = Buffer.alloc(64)
  header.writeUInt32BE(0x7f454c46, 0)
  header.writeUInt16LE(machine, 18)
  return header
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "schelf-artifacts-"))
  await mkdir(join(root, "dist", "linux-x86_64"), { recursive: true })
  await mkdir(join(root, "dist", "windows-aarch64-msi"), { recursive: true })
  await writeFile(join(root, "dist", "linux-x86_64", "notes-1.0.0-linux-x86_64.tar.gz"), "archive")
  await writeFile(join(root, "dist", "linux-x86_64", "linux-x86_64.executable"), "bin/notes\n")
  await writeFile(join(root, "dist", "windows-aarch64-msi", "Notes-windows-aarch64-msi.msi"), "msi")
  await writeFile(join(root, "Tool-arm.AppImage"), elf(0xb7))
  await writeFile(join(root, "Tool.AppImage"), elf(0x3e))
  await writeFile(join(root, "script.AppImage"), "#!/bin/sh\n")
  await mkdir(join(root, "electron"))
  await writeFile(join(root, "electron", "Notes-Setup-1.0.0.exe"), "installer")
  await writeFile(join(root, "electron", "Notes-Setup-1.0.0.exe.blockmap"), "block map")
  await writeFile(join(root, "electron", "Notes-1.0.0.msi"), "msi")
  await mkdir(join(root, "appimages"))
  const blockmap = embeddedBlockmap()
  const size = Buffer.alloc(4)
  size.writeUInt32BE(blockmap.length)
  await writeFile(
    join(root, "appimages", "Notes-1.0.0-x86_64.AppImage"),
    Buffer.concat([elf(0x3e), blockmap, size]),
  )
  await writeFile(join(root, "appimages", "Plain-1.0.0-x86_64.AppImage"), elf(0x3e))
})

afterAll(() => rm(root, { recursive: true }))

describe("Electron files", () => {
  test("carry the blockmap beside them, and it's not a file of its own", async () => {
    const artifacts = await collectArtifacts([join(root, "electron/*")], { format: "files", parts: {} })
    expect(artifacts.map(({ name, blockmap }) => ({ name, blockmap }))).toEqual([
      { name: "Notes-1.0.0.msi", blockmap: undefined },
      { name: "Notes-Setup-1.0.0.exe", blockmap: Buffer.from("block map").toString("base64") },
    ])
  })
})

describe("AppImages from electron-builder", () => {
  test("report the size of their embedded blockmap", async () => {
    const artifacts = await collectArtifacts([join(root, "appimages/*")], { format: "files", parts: {} })
    expect(artifacts.map(({ name, blockmapSize }) => ({ name, blockmapSize }))).toEqual([
      { name: "Notes-1.0.0-x86_64.AppImage", blockmapSize: embeddedBlockmap().length },
      { name: "Plain-1.0.0-x86_64.AppImage", blockmapSize: undefined },
    ])
  })
})

describe("Sabine bundles", () => {
  test("reads the platform and kind from the names Sabine's workflow gives", async () => {
    const artifacts = await collectArtifacts([join(root, "dist/**")], { format: "sabine", parts: {} })
    expect(
      artifacts.map(({ name, platform, kind, executable }) => ({ name, platform, kind, executable })),
    ).toEqual([
      {
        name: "notes-1.0.0-linux-x86_64.tar.gz",
        platform: "linux-x86_64",
        kind: "archive",
        executable: "bin/notes",
      },
      {
        name: "Notes-windows-aarch64-msi.msi",
        platform: "windows-aarch64",
        kind: "msi",
        executable: undefined,
      },
    ])
  })

  test("maps Sabine's AppImage target to its own kind", async () => {
    const artifact = await inferArtifact("/x/Notes-0.1.0-linux-aarch64-appimage.AppImage", {
      format: "sabine",
      parts: {},
    })
    expect(artifact).toMatchObject({ platform: "linux-aarch64", kind: "app-image" })
  })

  test("leave a named part's files to be read like any other file", async () => {
    const shape = {
      format: "sabine" as const,
      parts: { cli: { files: ["notes-cli-*"], platforms: ["linux-x86_64" as const] } },
    }
    expect(await inferArtifact("/x/notes-cli-linux-x86_64.tar.gz", shape)).toMatchObject({
      part: "cli",
      platform: "linux-x86_64",
      kind: "tarball",
    })
    const helper = {
      ...shape,
      parts: {
        helper: {
          files: ["notes-helper-*"],
          platforms: ["linux-x86_64" as const],
          format: "sabine" as const,
        },
      },
    }
    expect(await inferArtifact("/x/notes-helper-linux-x86_64-deb.deb", helper)).toMatchObject({
      part: "helper",
      kind: "deb",
    })
    expect(await inferArtifact("/x/Notes-0.1.0-linux-x86_64-deb.deb", shape)).toMatchObject({
      part: null,
      kind: "deb",
    })
  })

  test("refuses files that aren't Sabine bundles", () => {
    expect(inferArtifact("/x/notes.zip", { format: "sabine", parts: {} })).rejects.toThrow(
      "isn't named like a Sabine bundle",
    )
    expect(inferArtifact("/x/notes-linux-x86_64.deb", { format: "sabine", parts: {} })).rejects.toThrow(
      "no package kind",
    )
  })
})

describe("AppImages", () => {
  test("reads the architecture from the ELF header, not the name", async () => {
    expect(
      await inferArtifact(join(root, "Tool-arm.AppImage"), { format: "appimage", parts: {} }),
    ).toMatchObject({
      platform: "linux-aarch64",
      kind: "appimage",
    })
    expect(await inferArtifact(join(root, "Tool.AppImage"), { format: "appimage", parts: {} })).toMatchObject(
      {
        platform: "linux-x86_64",
      },
    )
  })

  test("refuses files that aren't AppImages", () => {
    expect(inferArtifact(join(root, "script.AppImage"), { format: "appimage", parts: {} })).rejects.toThrow(
      "x86_64 or aarch64",
    )
  })
})

describe("extensions", () => {
  test("are for every Luft unless the name carries an architecture", async () => {
    expect(
      await inferArtifact("/x/com.example.Rain.tar.zst", { format: "luft-extension", parts: {} }),
    ).toMatchObject({
      platform: "luft",
    })
    expect(
      await inferArtifact("/x/com.example.Rain-aarch64.tar.zst", { format: "luft-extension", parts: {} }),
    ).toMatchObject({
      platform: "luft-aarch64",
    })
    expect(
      await inferArtifact("/x/com.example.Rain-x86_64.tar.zst", { format: "luft-extension", parts: {} }),
    ).toMatchObject({
      platform: "luft-x86_64",
    })
  })
})

test("an empty match is an error", () => {
  expect(collectArtifacts([join(root, "nothing/*")], { format: "appimage", parts: {} })).rejects.toThrow(
    "No files match",
  )
})
