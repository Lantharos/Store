import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readListingToml, SCHELF_WORKFLOW, workflowFor } from "@schelf/protocol"
import { detectProject } from "../src/project/detect.ts"
import { replacedWorkflows, sabineInputs, sabineVersion } from "../src/setup/files.ts"
import { listingFiles } from "../src/setup/listing.ts"

const CALLS_SABINE = `jobs:
  release:
    uses: Lantharos/Sabine/.github/workflows/release-app.yml@9bf0e62d32c8c0d136137c7a7fce21b898961006
    with:
      sabine_version: v0.62
      rust_toolchain: "1.99"
      upgrade_from_sabine_version: v0.22
`
const METAINFO = `<component type="desktop-application">
  <id>al.kaleid.notes</id>
  <name>Notes</name>
  <summary>Notes</summary>
  <screenshots>
    <screenshot><image>store/screenshots/one.png</image></screenshot>
    <screenshot><image>store/screenshots/two.png</image></screenshot>
  </screenshots>
</component>
`
let root: string

async function write(path: string, contents: string) {
  await mkdir(join(root, path, ".."), { recursive: true })
  await writeFile(join(root, path), contents)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "schelf-setup-"))
  await write(".github/workflows/release.yml", CALLS_SABINE)
})

afterEach(() => rm(root, { recursive: true }))

test("the Sabine version comes from the project, even when its workflow pins a commit", async () => {
  await write(
    "desktop/Cargo.toml",
    '[dependencies]\nsabine = { git = "https://github.com/Lantharos/Sabine.git", tag = "v0.78" }\n',
  )
  expect(await sabineVersion(root)).toBe("v0.78")
})

test("the workflow keeps the build settings of the one it replaces", async () => {
  const sabineInputsFound = await sabineInputs(root)
  expect(sabineInputsFound).toEqual({ rust_toolchain: '"1.99"', upgrade_from_sabine_version: "v0.22" })
  const workflow = workflowFor({
    id: "al.kaleid.notes",
    kind: "app",
    format: "sabine",
    sabineVersion: "v0.78",
    sabineInputs: sabineInputsFound,
  })
  expect(workflow).toContain('rust_toolchain: "1.99"')
  expect(workflow).toContain("upgrade_from_sabine_version: v0.22")
})

test("the old release workflow is found, and the new one isn't", async () => {
  await write(
    SCHELF_WORKFLOW,
    workflowFor({ id: "al.kaleid.notes", kind: "app", format: "sabine", sabineVersion: "v0.78" }),
  )
  expect(await replacedWorkflows(root)).toEqual([".github/workflows/release.yml"])
})

test("a short description in Sabine.toml serves as the summary", async () => {
  await write("Sabine.toml", '[app]\nid = "al.kaleid.notes"\nname = "Notes"\ndescription = "Quick notes"\n')
  expect((await detectProject(root)).summary).toBe("Quick notes")
})

test("an Electron app's id comes from electron-builder's appId", async () => {
  await write(
    "package.json",
    JSON.stringify({ devDependencies: { electron: "45.0.0" }, build: { appId: "al.kaleid.raffi" } }),
  )
  expect((await detectProject(root)).id).toBe("al.kaleid.raffi")
})

test("a description too long for a summary isn't used as one", async () => {
  await write(
    "Sabine.toml",
    `[app]\nid = "al.kaleid.notes"\nname = "Notes"\ndescription = "${"long ".repeat(30)}"\n`,
  )
  expect((await detectProject(root)).summary).toBeUndefined()
})

test("the listing init writes keeps screenshots already in the listing folder where they are", async () => {
  await write("Sabine.toml", '[app]\nid = "al.kaleid.notes"\nname = "Notes"\n')
  await write("store/al.kaleid.notes.metainfo.xml", METAINFO)
  const project = await detectProject(root)
  const files = await listingFiles(project, { id: "al.kaleid.notes", name: "Notes", summary: "Notes" })
  expect(files.map((file) => file.path)).toEqual(["store/listing.toml"])
  expect(readListingToml(files[0]!.contents as string).screenshots).toEqual([
    "screenshots/one.png",
    "screenshots/two.png",
  ])
})
