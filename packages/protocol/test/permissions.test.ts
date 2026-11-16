import { describe, expect, test } from "bun:test"
import { readPermissions, readSchelfToml, SANDBOXED_DEFAULT, talkCovers, widens } from "../src/index.ts"

describe("permission declarations", () => {
  test("read what an app asks for the way Luft's sandbox does", () => {
    expect(
      readPermissions(
        '[app]\nid = "io.github.alice.Notes"\n\n[sandbox]\nnetwork = false\nfilesystems = ["xdg-documents", "xdg-download:ro"]\ndevices = ["usb"]\ntalk = ["org.mpris.MediaPlayer2.notes"]\nmicrophone = true\n',
      ),
    ).toEqual({
      network: false,
      filesystems: ["xdg-documents", "xdg-download:ro"],
      devices: ["usb"],
      talk: ["org.mpris.MediaPlayer2.notes"],
      x11: false,
      microphone: true,
      camera: false,
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

  test("take talk scoped to one object", () => {
    const appearance = "com.example.Shell@/com/example/Shell/Appearance"
    expect(readPermissions(`[sandbox]\ntalk = ["${appearance}"]\n`).talk).toEqual([appearance])
    expect(() => readPermissions('[sandbox]\ntalk = ["com.example.Shell@com/example"]\n')).toThrow()
    expect(() => readPermissions('[sandbox]\ntalk = ["com.example.*@/com/example"]\n')).toThrow()
    expect(() => readPermissions('[sandbox]\ntalk = ["org.freedesktop.systemd1@/org"]\n')).toThrow()
    const scoped = { ...SANDBOXED_DEFAULT, talk: [appearance] }
    expect(widens(scoped, { ...scoped, talk: ["com.example.Shell"] })).toBe(true)
    expect(widens(scoped, { ...scoped, talk: ["com.example.Shell@/com/example/Shell/Share"] })).toBe(true)
    expect(widens({ ...scoped, talk: ["com.example.Shell"] }, scoped)).toBe(false)
  })

  test("cover talk names the way the bus proxy matches them", () => {
    expect(talkCovers(["org.mpris.MediaPlayer2.*"], "org.mpris.MediaPlayer2")).toBe(true)
    expect(talkCovers(["org.mpris.MediaPlayer2.*"], "org.mpris.MediaPlayer2.notes")).toBe(true)
    expect(talkCovers(["org.mpris.MediaPlayer2.*"], "org.mpris.MediaPlayer2Extra")).toBe(false)
    expect(talkCovers(["org.mpris.MediaPlayer2"], "org.mpris.MediaPlayer2.notes")).toBe(false)
    expect(talkCovers(["com.example.Shell"], "com.example.Shell@/com/example/Shell/Appearance")).toBe(true)
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
    expect(widens(documents, { ...documents, camera: true })).toBe(true)
    expect(widens({ ...documents, x11: true }, documents)).toBe(false)
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
