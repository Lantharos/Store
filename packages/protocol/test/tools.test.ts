import { expect, test } from "bun:test"
import { parseConfig, SCHELF_TOML, schelfToml } from "../src/index.ts"

const read = (text: string) => parseConfig(SCHELF_TOML, schelfToml, text)
const keys = (text: string) => {
  const result = read(text)
  return result.ok ? [] : result.issues.map((issue) => issue.key)
}

test("a part or a whole project can be a tool", () => {
  expect(
    keys(`project = "lantharos/sabine"
format = "files"

[parts.cli]
files = ["sabine-cli-*"]
platforms = ["linux-x86_64", "macos-aarch64"]
tool = "sabine"
`),
  ).toEqual([])
  expect(
    keys(`project = "lantharos/schelf"\nformat = "files"\ntool = "schelf"\nplatforms = ["linux-x86_64"]\n`),
  ).toEqual([])
})

test("a tool is one program for a computer, with no store page and no updater of its own", () => {
  expect(
    keys(`project = "lantharos/schelf"
format = "files"
tool = "schelf"
listing = "store"
updater = "electron"
platforms = ["linux-x86_64", "android"]

[parts.helper]
files = ["helper-*"]
platforms = ["linux-x86_64"]
format = "sabine"
id = "com.lantharos.Helper"
tool = "schelf"
`).sort(),
  ).toEqual(["listing", "parts.helper.tool", "parts.helper.tool", "platforms.1", "updater"])
})
