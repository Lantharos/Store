import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { inspectArtifact } from "../src/inspect/index.ts"
import { inspectTool } from "../src/inspect/tool.ts"

const ELF = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(60)])

async function toolOf(files: Record<string, string | Buffer>) {
  const root = await mkdtemp(join(tmpdir(), "schelf-tool-"))
  for (const [path, body] of Object.entries(files)) {
    await mkdir(join(root, path, ".."), { recursive: true })
    await writeFile(join(root, path), body)
  }
  const facts = inspectTool(await inspectArtifact(root, null), "sabine.tar.gz")
  await rm(root, { recursive: true })
  return facts
}

test("a tool is one compiled program, wherever the archive keeps it", async () => {
  expect(await toolOf({ "sabine-1.0/sabine": ELF })).toEqual({
    program: "sabine-1.0/sabine",
    problem: null,
    shared: [],
  })
  expect((await toolOf({ sabine: ELF, "README.md": "hi" })).problem).toContain("holds 2 files")
  expect((await toolOf({ sabine: "#!/usr/bin/env python3\n" })).problem).toContain("no runtime")
})
