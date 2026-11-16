import { expect, test } from "bun:test"
import { wanted } from "../src/assets.ts"

test("takes the release assets a pattern names, with the blockmaps beside them", () => {
  const patterns = ["*.AppImage", "notes-*-x86_64.tar.gz"]
  expect(wanted("Notes-1.2.0.AppImage", patterns)).toBe(true)
  expect(wanted("Notes-1.2.0.AppImage.blockmap", patterns)).toBe(true)
  expect(wanted("notes-1.2.0-x86_64.tar.gz", patterns)).toBe(true)
  expect(wanted("notes-1.2.0-aarch64.tar.gz", patterns)).toBe(false)
  expect(wanted("latest-linux.yml", patterns)).toBe(false)
})
