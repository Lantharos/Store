import { expect, test } from "bun:test"
import { SANDBOXED_DEFAULT } from "@schelf/protocol"
import { comparePermissions } from "../src/inspect/permissions.ts"
import { emptyFacts, scanText } from "../src/inspect/strings.ts"

const strings = `
GET https://api.notes.example/v1/sync
xmlns="http://www.w3.org/2000/svg"
/dev/ttyUSB0
org.freedesktop.portal.FileChooser
org.mpris.MediaPlayer2.spotify
93.184.216.34
192.168.1.10
1.2.3
pkexec
`

test("finds hosts, devices, bus names and programs in a binary's strings", () => {
  const facts = emptyFacts()
  scanText(strings, "bin/notes", facts)
  expect(facts.hosts.map((entry) => entry.value)).toEqual(["api.notes.example"])
  expect(facts.addresses.map((entry) => entry.value)).toEqual(["93.184.216.34"])
  expect(facts.devices.map((entry) => entry.value)).toEqual(["/dev/ttyUSB0"])
  expect(facts.busNames.map((entry) => entry.value)).toEqual([
    "org.freedesktop.portal.FileChooser",
    "org.mpris.MediaPlayer2.spotify",
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
  expect(comparePermissions(null, { libraries: [], strings: facts, files: [] }).every((row) => row.declared)).toBe(true)
})
