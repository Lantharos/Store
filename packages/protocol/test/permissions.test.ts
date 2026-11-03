import { describe, expect, test } from "bun:test"
import { readPermissions, readSchelfToml, SANDBOXED_DEFAULT, widens } from "../src/index.ts"

describe("permission declarations", () => {
  test("read what an app asks for the way Luft's sandbox does", () => {
    expect(
      readPermissions(
        '[app]\nid = "io.github.alice.Notes"\n\n[sandbox]\nnetwork = false\nfilesystems = ["xdg-documents", "xdg-download:ro"]\ndevices = ["usb"]\ntalk = ["org.mpris.MediaPlayer2.notes"]\n',
      ),
    ).toEqual({
      network: false,
      filesystems: ["xdg-documents", "xdg-download:ro"],
      devices: ["usb"],
      talk: ["org.mpris.MediaPlayer2.notes"],
      unsandboxed: null,
    })
  })

  test("refuse what the sandbox refuses", () => {
    expect(() => readPermissions("[sandbox]\nunsandboxed = true\n")).toThrow()
    expect(() => readPermissions('[sandbox]\nreason = "because"\n')).toThrow()
    expect(() => readPermissions('[sandbox]\nfilesystems = ["host"]\n')).toThrow()
    expect(() => readPermissions('[sandbox]\ntalk = ["org.freedesktop.*"]\n')).toThrow()
    expect(() => readPermissions("[sandbox]\nshell = true\n")).toThrow()
    expect(readPermissions('[sandbox]\ntalk = ["org.freedesktop.FileManager1"]\n').talk).toEqual([
      "org.freedesktop.FileManager1",
    ])
  })

  test("notice an update that asks for more", () => {
    const documents = { ...SANDBOXED_DEFAULT, filesystems: ["xdg-documents:ro"] }
    expect(widens(documents, { ...documents, filesystems: ["xdg-documents"] })).toBe(true)
    expect(widens(documents, { ...documents, filesystems: [] })).toBe(false)
    expect(widens({ ...documents, filesystems: ["home:ro"] }, documents)).toBe(false)
    expect(widens(documents, { ...documents, talk: ["org.mpris.MediaPlayer2.notes"] })).toBe(true)
    expect(
      widens(
        { ...documents, talk: ["org.mpris.MediaPlayer2.*"] },
        { ...documents, talk: ["org.mpris.MediaPlayer2.notes"] },
      ),
    ).toBe(false)
    expect(widens(documents, null)).toBe(true)
    expect(widens(null, documents)).toBe(false)
  })
})

describe("schelf.toml", () => {
  test("ask extensions for the extension API they target", () => {
    expect(() =>
      readSchelfToml('id = "com.lantharos.Rain"\nkind = "extension"\nformat = "luft-extension"\n'),
    ).toThrow()
    expect(() => readSchelfToml('id = "com.lantharos.Rain"\nformat = "luft-extension"\n')).toThrow()
    expect(
      readSchelfToml(
        'id = "com.lantharos.Rain"\nkind = "extension"\nformat = "luft-extension"\n[requires]\nextension_api = 1\n',
      ).requires,
    ).toEqual({ extension_api: 1 })
  })
})
