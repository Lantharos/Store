import { expect, test } from "bun:test"
import { previousReleases } from "../src/deltas.ts"

test("patches from the three newest releases older than the new one", () => {
  const releases = ["1.2.0", "2.0.0", "1.10.0", "2.0.0-beta.2", "1.9.1", "2.1.0"].map((version) => ({
    version,
  }))
  expect(previousReleases(releases, "2.0.0").map((release) => release.version)).toEqual([
    "2.0.0-beta.2",
    "1.10.0",
    "1.9.1",
  ])
  expect(previousReleases(releases, "1.2.0")).toEqual([])
})
