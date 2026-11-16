import { expect, test } from "bun:test"
import { withUnopened } from "../src/results.ts"

test("a file the checks couldn't open is flagged, and fails the inspection when it's a tool", () => {
  const passed = { name: "inspection", status: "passed", summary: "3 executables inspected" } as const
  const deb = { name: "notes.deb", tool: false, reason: "it didn't unpack" }
  const tool = { name: "sabine.tar.gz", tool: true, reason: "it unpacks to 40.0 GB" }
  expect(withUnopened(passed, [])).toBe(passed)
  expect(withUnopened(passed, [deb])).toMatchObject({
    status: "warning",
    summary: "Couldn't look inside notes.deb (it didn't unpack), so a reviewer checks it by hand",
  })
  expect(withUnopened(passed, [deb, tool]).status).toBe("failed")
})
