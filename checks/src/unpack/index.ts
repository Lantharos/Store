import { copyFile, mkdir, open, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { runChecked } from "../run.ts"
import { type Entry, from7zListing, fromLongListing, fromMsiFileTable, fromMtree } from "./listing.ts"

const RPM_SCRIPTLETS = "RPM/scriptlets"
export const INSTALL_SCRIPTS = /^(DEBIAN\/(preinst|postinst|prerm|postrm|config|triggers)|RPM\/scriptlets)$/

export class TooBig extends Error {}

export async function squashfsOffset(path: string) {
  const file = await open(path)
  try {
    const header = Buffer.alloc(64)
    await file.read(header, 0, 64, 0)
    const sectionTable = Number(header.readBigUInt64LE(0x28))
    return sectionTable + header.readUInt16LE(0x3a) * header.readUInt16LE(0x3c)
  } finally {
    await file.close()
  }
}

interface Unpacker {
  tool: string
  pattern: RegExp
  list: (path: string) => Promise<Entry[]>
  extract: (path: string, into: string) => Promise<unknown>
}

const libarchiveListing = async (path: string) =>
  fromMtree(
    await runChecked("bsdtar", ["-cf", "-", "--format=mtree", "--options=!all,type,mode,size", `@${path}`]),
  )

async function extractRpm(path: string, into: string) {
  await runChecked("bsdtar", ["-xf", path, "-C", into])
  const scriptlets = await runChecked("rpm", [
    "-qp",
    "--scripts",
    "--triggers",
    "--filetriggers",
    "--nosignature",
    path,
  ])
  if (!scriptlets.trim()) return
  await mkdir(dirname(join(into, RPM_SCRIPTLETS)), { recursive: true })
  await writeFile(join(into, RPM_SCRIPTLETS), scriptlets)
}

const UNPACKERS: Unpacker[] = [
  {
    tool: "unsquashfs",
    pattern: /\.appimage$/i,
    list: async (path) =>
      fromLongListing(
        await runChecked("unsquashfs", ["-lln", "-o", String(await squashfsOffset(path)), "-d", "", path]),
      ),
    extract: async (path, into) =>
      runChecked("unsquashfs", [
        "-no-xattrs",
        "-quiet",
        "-o",
        String(await squashfsOffset(path)),
        "-d",
        into,
        path,
      ]),
  },
  {
    tool: "dpkg-deb",
    pattern: /\.deb$/i,
    list: async (path) => fromLongListing(await runChecked("dpkg-deb", ["-c", path])),
    extract: (path, into) => runChecked("dpkg-deb", ["-R", path, into]),
  },
  {
    tool: "msiextract",
    pattern: /\.msi$/i,
    list: async (path) => fromMsiFileTable(await runChecked("msiinfo", ["export", path, "File"])),
    extract: (path, into) => runChecked("msiextract", ["-C", into, path]),
  },
  {
    tool: "7z",
    pattern: /\.(exe|dmg)$/i,
    list: async (path) => from7zListing(await runChecked("7z", ["l", "-slt", path])),
    extract: (path, into) => runChecked("7z", ["x", "-y", "-bd", `-o${into}`, path]),
  },
  { tool: "rpm", pattern: /\.rpm$/i, list: libarchiveListing, extract: extractRpm },
  {
    tool: "bsdtar",
    pattern: /\.(zip|apk|pkg|tar\.gz|tgz|tar\.zst|tar\.xz|txz|tar\.bz2|tbz2)$/i,
    list: libarchiveListing,
    extract: (path, into) => runChecked("bsdtar", ["-xf", path, "-C", into]),
  },
]

export const unpackerFor = (path: string) => UNPACKERS.find((unpacker) => unpacker.pattern.test(path))

const gigabytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`

export function unpackWithin(limit: number) {
  let room = limit
  return async function unpack(path: string, into: string, asIs: boolean) {
    await mkdir(into, { recursive: true })
    if (asIs) {
      await copyFile(path, join(into, basename(path)))
      return []
    }
    const unpacker = unpackerFor(path)
    if (!unpacker) throw new Error(`Nothing unpacks ${basename(path)}`)
    const entries = await unpacker.list(path)
    const size = entries.reduce((total, entry) => total + entry.size, 0)
    if (size > room)
      throw new TooBig(
        `it unpacks to ${gigabytes(size)}, more than the ${gigabytes(room)} left to look inside`,
      )
    room -= size
    await unpacker.extract(path, into)
    return entries.filter((entry) => entry.setuid).map((entry) => entry.path)
  }
}
