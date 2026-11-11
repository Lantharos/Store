import { afterEach, beforeEach, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SCHELF_WORKFLOW, schelfTomlFor, workflowFor } from "@schelf/protocol"
import { validate } from "../src/check/validate.ts"
import { detectProject } from "../src/project/detect.ts"
import { helperBuild } from "../src/setup/helper.ts"

const RAIN = `id = "com.lantharos.Rain"
name = "Rain"
description = "Rain falls over the wallpaper."
version = "1.0.0"
api = 1
permissions = ["wallpaper"]

[helper]
path = "rain-sound"
`

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "schelf-extension-"))
  execFileSync("git", ["init", "-q"], { cwd: root })
  await writeFile(join(root, "extension.toml"), RAIN)
})

afterEach(() => rm(root, { recursive: true }))

test("an extension with a helper builds and packs it on both architectures", async () => {
  const project = await detectProject(root)
  expect(project).toMatchObject({ kind: "extension", format: "luft-extension" })
  expect(project.extension).toMatchObject({ id: "com.lantharos.Rain", api: 1, helper: "rain-sound" })

  const workflow = workflowFor({
    id: "com.lantharos.Rain",
    kind: "extension",
    format: "luft-extension",
    extensionApi: 1,
    helper: { path: "rain-sound", build: await helperBuild(root, "rain-sound") },
  })
  expect(workflow).toContain("runner: [ubuntu-24.04, ubuntu-24.04-arm]")
  expect(workflow).toContain("run: make rain-sound")
  expect(workflow).toContain("tar --append --file=extension.tar rain-sound")
  expect(workflow).toContain('"dist/com.lantharos.Rain-$(uname -m).tar.zst"')
  expect(workflow).toMatch(/runs-on: \$\{\{ matrix\.runner \}\}/)
})

test("the helper builds the way the project does", async () => {
  await writeFile(join(root, "Cargo.toml"), '[package]\nname = "rain"\n')
  expect(await helperBuild(root, "bin/rain-sound")).toBe(
    "cargo build --release --bin rain-sound && cp target/release/rain-sound bin/rain-sound",
  )
})

test("an extension without a helper stays one file", async () => {
  await writeFile(join(root, "extension.toml"), RAIN.replace(/\n\[helper\][\s\S]*$/, "\n"))
  expect((await detectProject(root)).extension?.helper).toBeUndefined()
  expect(workflowFor({ id: "com.lantharos.Rain", kind: "extension", format: "luft-extension" })).toContain(
    "zstd -19 -o dist/com.lantharos.Rain.tar.zst",
  )
})

test("schelf check asks for the oldest Luft the extension runs on", async () => {
  const setup = {
    id: "com.lantharos.Rain",
    kind: "extension",
    format: "luft-extension",
    extensionApi: 1,
  } as const
  await writeFile(join(root, "schelf.toml"), schelfTomlFor(setup))
  await mkdir(join(root, ".github/workflows"), { recursive: true })
  await writeFile(join(root, SCHELF_WORKFLOW), workflowFor(setup))
  const luft = async () =>
    (await validate(await detectProject(root))).issues.filter((issue) => issue.message.includes("Luft"))

  expect(await luft()).toEqual([
    {
      level: "error",
      message: "extension.toml doesn't say the oldest Luft it runs on",
      hint: 'Add [luft] with minimum = "1.0", or a nightly such as minimum = "1.0-nightly.27".',
    },
  ])
  await writeFile(join(root, "extension.toml"), `${RAIN}\n[luft]\nminimum = "1.2.0"\n`)
  expect((await luft()).map((issue) => issue.message)).toEqual([
    "extension.toml [luft] minimum: A Luft version looks like 1.2 or 1.2-nightly.21",
  ])
  await writeFile(join(root, "extension.toml"), `${RAIN}\n[luft]\nminimum = "1.0-nightly.27"\n`)
  expect(await luft()).toEqual([])
})
