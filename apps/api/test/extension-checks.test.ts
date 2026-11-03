import { describe, expect, test } from "vitest"
import { type QuickCheckInput, quickChecks } from "../src/publishing/quick-checks.ts"

function checks(platforms: string[], helper: boolean, iconKey: string | null = null) {
  const input = {
    app: { id: "com.example.Rain", kind: "extension", format: "luft-extension" },
    release: {
      version: "1.0.0",
      format: "luft-extension",
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
    listing: [{ locale: "en", name: "Rain", summary: "Rain over your desktop", description: "Rain." }],
    meta: { iconKey, categories: [] },
    screenshots: 0,
    lookalikes: [],
  } as unknown as QuickCheckInput
  return quickChecks(input)
}

const platformCheck = (platforms: string[], helper: boolean) =>
  checks(platforms, helper).find((check) => check.name === "platforms")!
const listingCheck = (iconKey: string | null) =>
  checks(["luft"], false, iconKey).find((check) => check.name === "listing")!

describe("extension checks", () => {
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

  test("an extension can't go to review without an icon", () => {
    expect(listingCheck(null).status).toBe("failed")
    expect(listingCheck("media/com.example.Rain/icon.svg").status).toBe("warning")
  })
})
