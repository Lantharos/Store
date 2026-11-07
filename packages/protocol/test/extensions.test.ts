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

  test("read the ports it listens on", () => {
    const access = readExtensionAccess(
      'permissions = ["clipboard"]\n\n[network]\nlisten = [{ port = 53317, protocol = "tcp" }, { port = 53317, protocol = "udp" }]\n',
    )
    expect(access).toEqual({
      permissions: ["clipboard"],
      helper: false,
      listen: [
        { port: 53317, protocol: "tcp" },
        { port: 53317, protocol: "udp" },
      ],
    })
    expect(extensionLabels(access)).toEqual([
      "Copy to your clipboard",
      "Take connections from devices on your network, on port 53317",
    ])
  })

  test("refuse a permission the extension API doesn't have", () => {
    expect(() => readExtensionAccess('permissions = ["camera"]\n')).toThrow()
  })

  test("asking for a new permission, a helper, a host or a port widens", () => {
    const before = { permissions: ["wallpaper" as const], helper: false }
    expect(extensionWidens(before, { permissions: ["wallpaper", "taskbar"], helper: false })).toBe(true)
    expect(extensionWidens(before, { permissions: ["wallpaper"], helper: true })).toBe(true)
    expect(extensionWidens(before, { permissions: [], helper: false })).toBe(false)
    expect(
      extensionWidens(before, { permissions: ["wallpaper"], helper: false, network: ["api.example.com"] }),
    ).toBe(true)
    const listening = { permissions: [], helper: false, listen: [{ port: 53317, protocol: "tcp" as const }] }
    expect(extensionWidens(listening, { ...listening, listen: [{ port: 53317, protocol: "udp" }] })).toBe(
      true,
    )
    expect(extensionWidens(listening, listening)).toBe(false)
  })
})
