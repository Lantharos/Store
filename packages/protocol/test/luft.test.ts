import { describe, expect, test } from "bun:test"
import type { ZodError } from "zod"
import { appIndex, luftVersionLabel, readLuftMinimum } from "../src/index.ts"

const CLOCK = 'id = "io.github.alice.Clock"\napi = 1\npermissions = ["wallpaper"]\n'

function refusal(manifest: string) {
  try {
    readLuftMinimum(manifest)
  } catch (error) {
    return (error as ZodError).issues[0]?.message
  }
}

describe("the Luft an extension needs", () => {
  test("is read from [luft] in its manifest, released or nightly", () => {
    expect(readLuftMinimum(`${CLOCK}\n[luft]\nminimum = "1.2"\n`)).toBe("1.2")
    expect(readLuftMinimum(`${CLOCK}\n[luft]\nminimum = "1.0-nightly.27"\n`)).toBe("1.0-nightly.27")
  })

  test("is asked for in words when it's missing", () => {
    const asked =
      'extension.toml needs the oldest Luft it runs on: add [luft] with minimum = "1.0", or a nightly such as minimum = "1.0-nightly.27"'
    expect(refusal(CLOCK)).toBe(asked)
    expect(refusal(`${CLOCK}\n[luft]\n`)).toBe(asked)
  })

  test("only takes versions Luft reads", () => {
    for (const minimum of ["1", "1.2.3", "v1.2", "1.2-beta.1", "1.2-nightly.", "latest"])
      expect(refusal(`${CLOCK}\n[luft]\nminimum = "${minimum}"\n`)).toBe(
        "A Luft version looks like 1.2 or 1.2-nightly.21",
      )
  })

  test("reads the way Luft names its versions", () => {
    expect(luftVersionLabel("1.2")).toBe("Luft 1.2")
    expect(luftVersionLabel("1.0-nightly.27")).toBe("Luft 1.0 nightly 27")
  })
})

describe("an extension release in the signed index", () => {
  const release = {
    version: "1.2.0",
    channel: "stable",
    published: "2026-11-11T09:00:00.000Z",
    notes: "",
    rollout: { percent: 100, paused: false },
    permissions: null,
    extension: { permissions: ["wallpaper"], helper: false },
    access: "limited",
    requires: { extension_api: 1, luft: "1.0-nightly.27" },
    runs_in_shell: true,
    provenance: {
      origin: "github-actions",
      repository: "alice/clock",
      workflow: null,
      ref: null,
      commit: null,
      run: null,
    },
    artifacts: [],
  }
  const index = {
    path: "index/v1/apps/io.github.alice.Clock.json",
    serial: 1,
    expires: "2026-12-11T09:00:00.000Z",
    version: 1,
    generated: "2026-11-11T09:00:00.000Z",
    id: "io.github.alice.Clock",
    kind: "extension",
    format: "luft-extension",
    publisher: { name: "Alice", slug: "alice", verified: true },
    listing: {},
    icon: null,
    screenshots: [],
    categories: [],
    homepage: null,
    support: null,
    privacy_url: null,
    content_rating: null,
    brand_color: null,
    licence: null,
    repository: null,
    distribution: "open",
    releases: [release],
  }

  test("carries the Luft it needs and whether it runs inside Luft", () => {
    expect(appIndex.parse(index).releases[0]).toMatchObject({
      requires: { extension_api: 1, luft: "1.0-nightly.27" },
      runs_in_shell: true,
    })
  })

  test("names a Luft version Luft can read", () => {
    const unreadable = { ...index, releases: [{ ...release, requires: { extension_api: 1, luft: "1.2.0" } }] }
    expect(appIndex.safeParse(unreadable).success).toBe(false)
  })
})
