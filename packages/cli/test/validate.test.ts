import { afterEach, beforeEach, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { listingTomlFor, SCHELF_WORKFLOW, schelfTomlFor, workflowFor } from "@schelf/protocol"
import { issueText } from "../src/check/issues.ts"
import { validate } from "../src/check/validate.ts"
import { detectProject } from "../src/project/detect.ts"
import { followSchelfUpdates } from "../src/project/sabine.ts"

const setup = {
  id: "io.github.alice.Notes",
  kind: "app",
  format: "sabine",
  sabineVersion: "v0.68",
  listing: "store",
} as const
const listing = {
  name: "Notes",
  summary: "A quick place for your thoughts",
  description: "Write things down.",
  categories: ["Office"],
  homepage: "https://example.com",
  support: "https://example.com/help",
  icon: "icon.svg",
  screenshots: ["one.png", "two.png"],
}

function png(width: number, height: number) {
  const bytes = new Uint8Array(40)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}
const sabineToml = '[app]\nid = "io.github.alice.Notes"\nname = "Notes"\nversion = "1.2.0"\n'
let root: string

async function write(path: string, contents: string | Uint8Array) {
  await mkdir(join(root, path, ".."), { recursive: true })
  await writeFile(join(root, path), contents)
}

const messages = async () =>
  (await validate(await detectProject(root))).issues.map((issue) => `${issue.level}: ${issueText(issue)}`)

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "schelf-project-"))
  execFileSync("git", ["init", "-q"], { cwd: root })
  execFileSync("git", ["remote", "add", "origin", "git@github.com:alice/notes.git"], { cwd: root })
  await write("Sabine.toml", followSchelfUpdates(sabineToml))
  await cp(
    new URL("../../appstream/test/fixtures/notes.metainfo.xml", import.meta.url).pathname,
    join(root, "data", "io.github.alice.Notes.metainfo.xml"),
    { recursive: true },
  )
  await write("schelf.toml", schelfTomlFor(setup))
  await write(SCHELF_WORKFLOW, workflowFor(setup))
  await write("store/listing.toml", listingTomlFor(listing))
  await write("store/icon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')
  await write("store/one.png", png(1280, 800))
  await write("store/two.png", png(1280, 800))
})

afterEach(() => rm(root, { recursive: true }))

test("a project set up by init is ready to publish", async () => {
  const project = await detectProject(root)
  expect(project).toMatchObject({
    format: "sabine",
    id: "io.github.alice.Notes",
    name: "Notes",
    summary: "A quick place for your thoughts",
    licence: "GPL-3.0-or-later",
    repository: { owner: "alice", name: "notes" },
    found: ["Sabine.toml", "data/io.github.alice.Notes.metainfo.xml"],
  })
  expect(await messages()).toEqual([])
})

test("ids that disagree are an error", async () => {
  await write("schelf.toml", schelfTomlFor({ ...setup, id: "io.github.alice.Other" }))
  expect(await messages()).toContain(
    "error: schelf.toml id: io.github.alice.Other, but Sabine.toml says io.github.alice.Notes",
  )
})

test("a Sabine app that doesn't update from Schelf, and a stale workflow, are called out", async () => {
  await write("Sabine.toml", sabineToml)
  await write(SCHELF_WORKFLOW, workflowFor({ ...setup, sabineVersion: "v0.67" }))
  const found = await messages()
  expect(found).toContain(
    "warning: Sabine.toml updates.provider: isn't schelf, so copies on Windows and macOS won't get updates",
  )
  expect(found).toContain(`warning: ${SCHELF_WORKFLOW}: builds with Sabine 0.67, schelf.toml requires 0.68`)
})

test("a broken schelf.toml is explained", async () => {
  await write("schelf.toml", 'id = "notes"\nformat = "sabine"\n')
  expect(await messages()).toContain(
    "error: schelf.toml id: An app id is reverse DNS, like io.github.alice.Notes",
  )
})

test("a permission declaration that asks for something that doesn't exist is an error", async () => {
  await write("schelf.toml", schelfTomlFor({ ...setup, permissions: "Sabine.toml" }))
  await write("Sabine.toml", `${followSchelfUpdates(sabineToml)}\n[sandbox]\nfilesystems = ["/etc"]\n`)
  expect(await messages()).toContain(
    "error: Sabine.toml sandbox.filesystems.0: /etc isn't a folder an app can ask for.",
  )
})

test("a screenshot too small for the store page is named with its key", async () => {
  await write("store/two.png", png(320, 200))
  expect(await messages()).toContain(
    "error: store/listing.toml screenshots.1: two.png is 320×200; screenshots are at least 640 pixels on each side",
  )
})

test("a missing workflow is an error", async () => {
  await rm(join(root, SCHELF_WORKFLOW))
  expect(await messages()).toContain(`error: ${SCHELF_WORKFLOW}: doesn't exist`)
})
