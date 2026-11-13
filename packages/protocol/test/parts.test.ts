import { describe, expect, test } from "bun:test"
import {
  type HostedRelease,
  missingPlatforms,
  offeredReleases,
  type PartPlan,
  parseConfig,
  partOf,
  partReleases,
  resolveLink,
  SCHELF_TOML,
  schelfToml,
} from "../src/index.ts"

const SABINE = `project = "lantharos/sabine"
format = "files"

[parts.cli]
files = ["sabine-cli-*"]
platforms = ["linux-x86_64", "macos-aarch64"]

[parts.runtime]
files = ["sabine-runtime-*"]
platforms = ["linux-x86_64"]
`

const read = (text: string) => parseConfig(SCHELF_TOML, schelfToml, text)

const plan: PartPlan = {
  platforms: ["windows-x86_64", "linux-x86_64"],
  parts: { cli: { files: ["notes-cli-*"], platforms: ["linux-x86_64"] } },
}

function hosted(version: string, files: [string, string | null, string][]): HostedRelease {
  return {
    version,
    channel: "stable",
    published: "2026-11-13T10:00:00.000Z",
    notes: "",
    rollout: 100,
    bridge: false,
    updater: null,
    files: files.map(([name, part, platform]) => ({
      part,
      name,
      platform: platform as never,
      kind: "tarball",
      url: `https://dl.schelf.store/apps/x/${version}/${platform}/${name}`,
      size: 1,
      sha256: "a".repeat(64),
      sha512: null,
      signature: null,
      attestation: null,
      blockmapSize: null,
    })),
  }
}

describe("parts in schelf.toml", () => {
  test("a project can be only named parts, with no store page", () => {
    const parsed = read(SABINE)
    expect(parsed.ok && Object.keys(parsed.value.parts)).toEqual(["cli", "runtime"])
    const listed = read(SABINE.replace('format = "files"', 'format = "files"\nlisting = "store"'))
    expect(!listed.ok && listed.issues.map((issue) => issue.key)).toEqual(["listing"])
  })

  test("a part isn't named like a system, and the app's systems fit its format", () => {
    const system = read(SABINE.replace("[parts.cli]", "[parts.linux]"))
    expect(!system.ok && system.issues[0]?.key).toBe("parts.linux")
    const android = read('id = "io.github.alice.Notes"\nformat = "sabine"\nplatforms = ["android"]\n')
    expect(!android.ok && android.issues[0]?.key).toBe("platforms.0")
  })
})

test("a Sabine part has its own app id, and a part of files its updater", () => {
  const sabine = read(
    SABINE.replace(
      'platforms = ["linux-x86_64"]\n',
      'platforms = ["linux-x86_64"]\nformat = "sabine"\nupdater = "tauri"\n',
    ),
  )
  expect(!sabine.ok && sabine.issues.map((issue) => issue.key)).toEqual([
    "parts.runtime.id",
    "parts.runtime.updater",
  ])
})

describe("files and their parts", () => {
  test("a file joins the part whose names it matches, and the app otherwise", () => {
    expect(partOf("notes-cli-linux-x86_64.tar.gz", plan)).toBe("cli")
    expect(partOf("Notes-1.0.0-setup.exe", plan)).toBeNull()
  })

  test("a file that matches two parts is refused", () => {
    expect(() =>
      partOf("notes-cli.zip", {
        parts: { a: { files: ["notes-*"], platforms: [] }, b: { files: ["*.zip"], platforms: [] } },
      }),
    ).toThrow("matches the files of a and b")
  })

  test("every system schelf.toml names is carried, in the app and in each part", () => {
    expect(
      missingPlatforms(plan, [
        { part: null, platform: "windows-x86_64" },
        { part: "cli", platform: "linux-x86_64" },
      ]),
    ).toEqual([{ part: null, platform: "linux-x86_64" }])
  })
})

describe("links to parts", () => {
  const releases = [
    hosted("1.1.0", [
      ["notes-1.1.0-linux.tar.gz", null, "linux-x86_64"],
      ["notes-cli-1.1.0-linux.tar.gz", "cli", "linux-x86_64"],
    ]),
    hosted("1.0.0", [
      ["notes-1.0.0-android.tar.gz", null, "android"],
      ["notes-cli-1.0.0-linux.tar.gz", "cli", "linux-x86_64"],
    ]),
  ]
  const options = { followRollout: false, draw: 0.5 }

  test("a part's link serves that part's file, and the app's link never does", () => {
    expect(resolveLink(partReleases(releases, "cli"), "linux-x86_64", undefined, options)?.file.name).toBe(
      "notes-cli-1.1.0-linux.tar.gz",
    )
    expect(resolveLink(partReleases(releases, null), "linux", undefined, options)?.file.name).toBe(
      "notes-1.1.0-linux.tar.gz",
    )
  })

  test("a system taken out of schelf.toml stops being offered", () => {
    const offered = offeredReleases(releases, plan)
    expect(resolveLink(partReleases(offered, null), "android", undefined, options)).toBeUndefined()
    expect(resolveLink(partReleases(releases, null), "android", undefined, options)?.release.version).toBe(
      "1.0.0",
    )
  })

  test("a project of only parts offers nothing as the app", () => {
    const offered = offeredReleases(releases, { platforms: null, parts: plan.parts })
    expect(offered.flatMap((release) => release.files.map((file) => file.part))).toEqual(["cli", "cli"])
  })
})
