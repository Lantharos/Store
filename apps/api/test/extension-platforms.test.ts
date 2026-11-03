import { describe, expect, test } from "vitest"
import { type QuickCheckInput, quickChecks } from "../src/publishing/quick-checks.ts"

function platformCheck(platforms: string[], helper: boolean) {
  const input = {
    app: { id: "com.example.Rain", kind: "extension", format: "luft-extension" },
    release: {
      version: "1.0.0",
      requires: { extension_api: 1 },
      permissions: null,
      extensionAccess: { permissions: ["wallpaper"], helper },
    },
    previous: null,
    artifacts: platforms.map((platform) => ({
      name: `rain-${platform}.tar.zst`,
      platform,
      kind: "extension",
      executable: null,
    })),
    attestations: new Map(),
    namespaces: [],
    listing: [],
    meta: null,
    screenshots: 0,
    lookalikes: [],
  } as unknown as QuickCheckInput
  return quickChecks(input).find((check) => check.name === "platforms")!
}

describe("extension platforms", () => {
  test("an extension without a helper ships one luft file", () => {
    expect(platformCheck(["luft"], false).status).toBe("passed")
    expect(platformCheck(["luft-x86_64"], false)).toMatchObject({ status: "failed" })
  })

  test("an extension with a helper ships a build for each architecture", () => {
    expect(platformCheck(["luft-x86_64", "luft-aarch64"], true).status).toBe("passed")
    expect(platformCheck(["luft"], true)).toMatchObject({
      status: "failed",
      summary: "An extension that runs its own program ships a file per architecture, not one luft file",
    })
    expect(platformCheck(["luft-x86_64"], true)).toMatchObject({
      status: "failed",
      summary: "The helper needs a build for luft-aarch64 too",
    })
  })
})
