import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SANDBOXED_DEFAULT } from "@schelf/protocol"
import { inspectArtifact } from "../src/inspect/index.ts"
import { comparePermissions } from "../src/inspect/permissions.ts"
import { emptyFacts, scanText } from "../src/inspect/strings.ts"

const strings = `
GET https://api.notes.app/v1/sync
http://ns.adobe.
http://www.w3.or
xmlns="http://www.w3.org/2000/svg"
Font licence at http://scripts.sil.org/OFL by http://abattis.org
<a href="http://www.css" rel="stylesheet">
see https://github.com/gfx-rs/wgpu/issues/5276
https://github.com/notes/models/releases/download/v1/model.bin
/dev/ttyUSB0
org.freedesktop.portal.FileChooser
org.mpris.MediaPlayer2.spotify
com.lantharos.Kestrel.Appearance
org.freedesktop.DBus.Error.ServiceUnknown
net.imput.heliumInvalidKeyUpdatelogical_position
93.184.216.34
192.168.1.10
1.2.3
pkexec
`

test("finds hosts, devices, bus names and programs in a binary's strings", () => {
  const facts = emptyFacts()
  scanText(strings, "bin/notes", facts)
  expect(facts.hosts.map((entry) => entry.value)).toEqual(["api.notes.app", "github.com"])
  expect(facts.addresses.map((entry) => entry.value)).toEqual(["93.184.216.34"])
  expect(facts.devices.map((entry) => entry.value)).toEqual(["/dev/ttyUSB0"])
  expect(facts.busNames.map((entry) => entry.value)).toEqual([
    "org.freedesktop.portal.FileChooser",
    "org.mpris.MediaPlayer2.spotify",
    "com.lantharos.Kestrel.Appearance",
  ])
  expect(facts.programs.map((entry) => entry.value)).toEqual(["pkexec"])
})

test("sets what the binary shows against what the app declares", () => {
  const facts = emptyFacts()
  scanText(strings, "bin/notes", facts)
  const rows = comparePermissions(
    { ...SANDBOXED_DEFAULT, network: false, devices: ["serial"] },
    { libraries: [{ file: "bin/notes", libraries: ["libusb-1.0.so.0"] }], strings: facts, files: [] },
  )
  expect(rows.map((row) => `${row.declared ? "declared" : "undeclared"} ${row.permission}`)).toEqual([
    "undeclared network",
    "undeclared devices: usb",
    "undeclared talk: org.mpris.MediaPlayer2.spotify",
    "undeclared full access",
    "declared devices: serial",
  ])
  expect(
    comparePermissions(null, { libraries: [], strings: facts, files: [] }).every((row) => row.declared),
  ).toBe(true)
})

test("a GSettings schema the app ships isn't taken for a bus name it talks to", async () => {
  const root = await mkdtemp(join(tmpdir(), "schelf-inspect-"))
  await mkdir(join(root, "bin"))
  await mkdir(join(root, "share/glib-2.0/schemas"), { recursive: true })
  await writeFile(join(root, "bin/notes"), "com.example.Notes.window\norg.freedesktop.Notifications\n")
  await writeFile(
    join(root, "share/glib-2.0/schemas/com.example.Notes.gschema.xml"),
    '<schemalist><schema id="com.example.Notes.window" path="/com/example/Notes/window/"/></schemalist>',
  )
  const inspection = await inspectArtifact(root, null)
  await rm(root, { recursive: true })
  expect(inspection.strings.busNames.map((entry) => entry.value)).toEqual(["org.freedesktop.Notifications"])
})
