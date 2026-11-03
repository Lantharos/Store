import { describe, expect, test } from "bun:test"
import { parse } from "yaml"
import {
  channelFromVersion,
  electronFeed,
  electronFeedName,
  type HostedFile,
  type HostedRelease,
  inferFile,
  latestRelease,
  resolveLink,
  tauriFeed,
  updaterRelease,
} from "../src/index.ts"

function file(
  name: string,
  platform: HostedFile["platform"],
  kind: HostedFile["kind"],
  extra: Partial<HostedFile> = {},
): HostedFile {
  return {
    name,
    platform,
    kind,
    url: `https://dl.schelf.store/apps/lantharos.raffi/x/${platform}/${name}`,
    size: 100,
    sha256: "a".repeat(64),
    sha512: "c2hhNTEy",
    signature: null,
    attestation: null,
    ...extra,
  }
}

function release(
  version: string,
  rollout: number,
  files: HostedFile[],
  extra: Partial<HostedRelease> = {},
): HostedRelease {
  return {
    version,
    channel: "stable",
    published: "2026-11-03T10:00:00.000Z",
    notes: "",
    rollout,
    bridge: false,
    updater: null,
    files,
    ...extra,
  }
}

const STAGED = { followRollout: false, draw: 0.5 }

describe("stable links", () => {
  const releases = [
    release("1.2.0", 10, [file("raffi-1.2.0.exe", "windows-x86_64", "exe")]),
    release("1.1.0", 100, [
      file("raffi-1.1.0.msi", "windows-x86_64", "msi"),
      file("raffi-1.1.0.exe", "windows-x86_64", "exe"),
      file("raffi-1.1.0-universal.dmg", "macos-universal", "dmg"),
    ]),
  ]

  test("serve the newest release that reached everyone", () => {
    expect(resolveLink(releases, "windows-x86_64", undefined, STAGED)?.file.name).toBe("raffi-1.1.0.exe")
  })

  test("follow the rollout when the publisher opts in, by the request's draw", () => {
    expect(
      resolveLink(releases, "windows", undefined, { followRollout: true, draw: 0.05 })?.release.version,
    ).toBe("1.2.0")
    expect(
      resolveLink(releases, "windows", undefined, { followRollout: true, draw: 0.5 })?.release.version,
    ).toBe("1.1.0")
  })

  test("prefer the installer, and take a kind when asked", () => {
    expect(resolveLink(releases, "windows", "msi", STAGED)?.file.name).toBe("raffi-1.1.0.msi")
  })

  test("give an Apple silicon Mac the universal build", () => {
    expect(resolveLink(releases, "macos-aarch64", undefined, STAGED)?.file.platform).toBe("macos-universal")
  })

  test("never serve a bridge, even when it's the newest", () => {
    const bridged = [
      release("1.3.0", 100, [file("raffi-1.3.0.exe", "windows-x86_64", "exe")], { bridge: true }),
      ...releases,
    ]
    expect(resolveLink(bridged, "windows", undefined, STAGED)?.release.version).toBe("1.1.0")
    expect(latestRelease(bridged, STAGED)?.version).toBe("1.1.0")
  })

  test("find nothing for a system no release was built for", () => {
    expect(resolveLink(releases, "linux-x86_64", undefined, STAGED)).toBeUndefined()
  })
})

describe("update feeds", () => {
  const tauri = release(
    "2.0.0",
    100,
    [
      file("Raffi_2.0.0_x64-setup.exe", "windows-x86_64", "exe", { signature: "sig-nsis" }),
      file("Raffi_2.0.0_x64_en-US.msi", "windows-x86_64", "msi", { signature: "sig-msi" }),
      file("Raffi_universal.app.tar.gz", "macos-universal", "tarball", { signature: "sig-app" }),
      file("Raffi_universal.dmg", "macos-universal", "dmg"),
      file("raffi_2.0.0_amd64.AppImage", "linux-x86_64", "appimage", { signature: "sig-appimage" }),
    ],
    { updater: "tauri" },
  )

  test("Tauri's feed lists each signed bundle under its target, with the installer as the default", () => {
    const feed = tauriFeed(tauri)!
    expect(feed.version).toBe("2.0.0")
    expect(feed.platforms["windows-x86_64"]?.signature).toBe("sig-nsis")
    expect(feed.platforms["windows-x86_64-msi"]?.signature).toBe("sig-msi")
    expect(feed.platforms["darwin-aarch64"]?.signature).toBe("sig-app")
    expect(feed.platforms["darwin-x86_64-app"]?.signature).toBe("sig-app")
    expect(feed.platforms["linux-x86_64"]?.signature).toBe("sig-appimage")
    expect(Object.values(feed.platforms).every((entry) => entry.url.includes("dl.schelf.store"))).toBe(true)
  })

  test("Tauri's feed has nothing to offer without signatures", () => {
    expect(tauriFeed(release("2.0.0", 100, [file("Raffi.exe", "windows-x86_64", "exe")]))).toBeNull()
  })

  test("electron-updater's files are read by name, channel and system", () => {
    expect(electronFeedName("latest.yml")?.channel).toBe("stable")
    expect(electronFeedName("beta-mac.yml")?.channel).toBe("beta")
    expect(electronFeedName("latest-linux-arm64.yml")?.files.platforms).toEqual(["linux-aarch64"])
    expect(electronFeedName("raffi.json")).toBeNull()
  })

  test("latest.yml is what electron-updater reads, with the rollout as its staging percentage", () => {
    const electron = release(
      "1.4.0",
      25,
      [
        file("Raffi-Setup-1.4.0.exe", "windows-x86_64", "exe", { sha512: "d2luZG93cw==", size: 5000 }),
        file("Raffi-1.4.0-mac.zip", "macos-universal", "zip", { sha512: "bWFj" }),
      ],
      { updater: "electron", notes: "Faster: search\nand more" },
    )
    const windows = parse(electronFeed(electron, "latest.yml")!)
    expect(windows).toEqual({
      version: "1.4.0",
      files: [{ url: electron.files[0]!.url, sha512: "d2luZG93cw==", size: 5000 }],
      path: electron.files[0]!.url,
      sha512: "d2luZG93cw==",
      releaseDate: "2026-11-03T10:00:00.000Z",
      stagingPercentage: 25,
      releaseNotes: "Faster: search\nand more",
    })
    expect(parse(electronFeed(electron, "latest-mac.yml")!).files[0].url).toContain("mac.zip")
    expect(electronFeed(electron, "latest-linux.yml")).toBeNull()
  })

  test("after a move to Sabine, the old updater's feed only ever offers the bridge", () => {
    const releases = [
      release("3.0.0", 100, [file("raffi-windows-x86_64.msi", "windows-x86_64", "msi")], {
        updater: "sabine",
      }),
      release("2.9.9", 100, [file("Raffi-Setup-2.9.9.exe", "windows-x86_64", "exe")], {
        updater: "electron",
        bridge: true,
      }),
      release("2.9.0", 100, [file("Raffi-Setup-2.9.0.exe", "windows-x86_64", "exe")], {
        updater: "electron",
      }),
    ]
    const old = releases.find((candidate) => candidate.updater === "electron")!
    expect(parse(electronFeed(old, "latest.yml")!).version).toBe("2.9.9")
    expect(updaterRelease(releases, "electron", STAGED)?.bridge).toBe(true)
    expect(resolveLink(releases, "windows", undefined, STAGED)?.release.version).toBe("3.0.0")
  })
})

describe("files and channels", () => {
  test("a file's kind and system come from its name", () => {
    expect(inferFile("Raffi_1.0.0_aarch64.dmg")).toEqual({ kind: "dmg", platform: "macos-aarch64" })
    expect(inferFile("raffi-1.0.0-arm64.AppImage")).toEqual({ kind: "appimage", platform: "linux-aarch64" })
    expect(inferFile("raffi-windows-x64.zip")).toEqual({ kind: "zip", platform: "windows-x86_64" })
    expect(inferFile("raffi.apk")).toEqual({ kind: "apk", platform: "android" })
    expect(inferFile("raffi-1.0.0.tar.gz")).toEqual({ kind: "tarball", platform: "any" })
    expect(() => inferFile("raffi.iso")).toThrow()
  })

  test("a pre-release version names its channel", () => {
    expect(channelFromVersion("2.0.0-beta.3")).toBe("beta")
    expect(channelFromVersion("2.0.0-rc.1")).toBe("beta")
    expect(channelFromVersion("2.0.0-nightly.20261103")).toBe("nightly")
    expect(channelFromVersion("2.0.0")).toBe("stable")
    expect(channelFromVersion("2.0.0-1")).toBe("stable")
  })
})
