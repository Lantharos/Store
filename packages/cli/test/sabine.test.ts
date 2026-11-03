import { describe, expect, test } from "bun:test"
import { followSchelfUpdates, readSabine } from "../src/project/sabine.ts"

describe("followSchelfUpdates", () => {
  test("adds an [updates] table when there is none", () => {
    expect(followSchelfUpdates('[app]\nid = "a.b.C"\nname = "C"\n')).toBe(
      '[app]\nid = "a.b.C"\nname = "C"\n\n[updates]\nprovider = "schelf"\n',
    )
  })

  test("replaces another provider and its source, keeping the rest", () => {
    const before = [
      "[app]",
      'id = "a.b.C"',
      'name = "C"',
      "",
      "[updates]",
      'provider = "github"',
      'repository = "alice/c"',
      'public_key = "abc"',
      'policy = "notify"',
      "",
      "[sandbox]",
      "network = false",
    ].join("\n")
    const after = followSchelfUpdates(before)
    expect(after).toBe(
      [
        "[app]",
        'id = "a.b.C"',
        'name = "C"',
        "",
        "[updates]",
        'provider = "schelf"',
        'policy = "notify"',
        "",
        "[sandbox]",
        "network = false",
      ].join("\n"),
    )
    expect(readSabine(after)).toMatchObject({ updatesProvider: "schelf", sandbox: { network: false } })
  })
})

test("readSabine needs an id and a name", () => {
  expect(() => readSabine('[app]\nid = "a.b.C"')).toThrow("id and name")
})
