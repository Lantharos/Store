import { describe, expect, test } from "bun:test"
import { extensionLabels, extensionWidens, readExtensionAccess } from "../src/index.ts"

describe("extension permissions", () => {
  test("read what a manifest asks for, with its helper", () => {
    const access = readExtensionAccess(
      'id = "io.github.alice.Clock"\napi = 1\npermissions = ["wallpaper", "weather"]\n\n[helper]\npath = "clock-helper"\n',
    )
    expect(access).toEqual({ permissions: ["wallpaper", "weather"], helper: true })
    expect(extensionLabels(access)).toEqual([
      "Draw over the wallpaper",
      "See the weather where you are",
      "Runs its own program",
    ])
  })

  test("read the hosts it connects to", () => {
    const access = readExtensionAccess('permissions = ["taskbar"]\n\n[network]\nhosts = ["app.pult.sh"]\n')
    expect(access).toEqual({ permissions: ["taskbar"], helper: false, network: ["app.pult.sh"] })
    expect(extensionLabels(access)).toEqual(["Add buttons to the taskbar", "Connect to app.pult.sh"])
  })

  test("refuse a permission the extension API doesn't have", () => {
    expect(() => readExtensionAccess('permissions = ["camera"]\n')).toThrow()
  })

  test("asking for a new permission, a helper or a host widens", () => {
    const before = { permissions: ["wallpaper" as const], helper: false }
    expect(extensionWidens(before, { permissions: ["wallpaper", "taskbar"], helper: false })).toBe(true)
    expect(extensionWidens(before, { permissions: ["wallpaper"], helper: true })).toBe(true)
    expect(extensionWidens(before, { permissions: [], helper: false })).toBe(false)
    expect(
      extensionWidens(before, { permissions: ["wallpaper"], helper: false, network: ["api.example.com"] }),
    ).toBe(true)
  })
})
