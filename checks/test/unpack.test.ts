import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { squashfsOffset, unpackerFor } from "../src/unpack/index.ts"
import { from7zListing, fromLongListing, fromMsiFileTable, fromMtree } from "../src/unpack/listing.ts"

test("picks the unpacker by the file's name", () => {
  const tools = ["Notes-1.0-x86_64.AppImage", "notes.deb", "notes.rpm", "Notes.msi", "Setup.EXE", "Notes.dmg"]
    .concat(["notes.tar.zst", "notes.tgz", "notes.zip", "notes.tar"])
    .map((name) => unpackerFor(name)?.tool)
  expect(tools).toEqual([
    "unsquashfs",
    "dpkg-deb",
    "rpm",
    "msiextract",
    "7z",
    "7z",
    "bsdtar",
    "bsdtar",
    "bsdtar",
    undefined,
  ])
})

test("finds an AppImage's filesystem after the runtime's section headers", async () => {
  const folder = await mkdtemp(join(tmpdir(), "schelf-appimage-"))
  const header = Buffer.alloc(64)
  header.writeBigUInt64LE(186_000n, 0x28)
  header.writeUInt16LE(64, 0x3a)
  header.writeUInt16LE(30, 0x3c)
  await writeFile(join(folder, "Notes.AppImage"), header)
  expect(await squashfsOffset(join(folder, "Notes.AppImage"))).toBe(186_000 + 64 * 30)
  await rm(folder, { recursive: true })
})

test("reads sizes and setuid bits from every kind of listing", () => {
  expect(
    fromLongListing(
      [
        "drwxr-xr-x root/root         0 2026-11-16 02:42 ./usr/bin/",
        "-rwsr-xr-x root/root        18 2026-11-16 02:42 ./usr/bin/helper",
        "-rwxr-sr-x 0/0               6 2026-11-16 02:42 /usr/bin/with space",
        "lrwxrwxrwx root/root         0 2026-11-16 02:42 ./usr/bin/link -> helper",
      ].join("\n"),
    ),
  ).toEqual([
    { path: "usr/bin/helper", size: 18, setuid: true },
    { path: "usr/bin/with space", size: 6, setuid: true },
  ])
  expect(
    fromMtree(
      "#mtree\n./usr/bin mode=755 type=dir\n./usr/bin/helper mode=4755 type=file size=18\n./usr/bin/caf\\303\\251\\040bar mode=644 type=file size=2\n./usr/bin/link mode=777 type=link\n",
    ),
  ).toEqual([
    { path: "usr/bin/helper", size: 18, setuid: true },
    { path: "usr/bin/café bar", size: 2, setuid: false },
  ])
  expect(
    from7zListing(
      "Listing archive: Setup.exe\n\n--\nPath = Setup.exe\nType = PE\nPhysical Size = 900\n\n----------\nPath = bin\nFolder = +\nSize = 0\n\nPath = bin/notes\nFolder = -\nSize = 5000\nAttributes = A -rwsr-xr-x\n\nPath = notes.dll\nSize = 300\nAttributes = A\n",
    ),
  ).toEqual([
    { path: "bin/notes", size: 5000, setuid: true },
    { path: "notes.dll", size: 300, setuid: false },
  ])
  expect(
    fromMsiFileTable(
      "File\tComponent_\tFileName\tFileSize\tVersion\tLanguage\tAttributes\tSequence\r\ns72\ts72\tl255\ti4\tS72\tS20\tI2\ti4\r\nFile\tFile\r\nF1\tC\tnotes.exe\t241\t\t\t512\t1\r\n",
    ),
  ).toEqual([{ path: "notes.exe", size: 241, setuid: false }])
})
