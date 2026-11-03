import { mkdir, open } from "node:fs/promises"
import { runChecked } from "./run.ts"

async function squashfsOffset(path: string) {
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

const UNPACKERS: [RegExp, (path: string, into: string) => Promise<unknown>][] = [
  [
    /\.appimage$/i,
    async (path, into) =>
      runChecked("unsquashfs", [
        "-no-xattrs",
        "-quiet",
        "-o",
        String(await squashfsOffset(path)),
        "-d",
        into,
        path,
      ]),
  ],
  [/\.deb$/i, (path, into) => runChecked("dpkg-deb", ["-R", path, into])],
  [/\.msi$/i, (path, into) => runChecked("msiextract", ["-C", into, path])],
  [/\.(exe|dmg)$/i, (path, into) => runChecked("7z", ["x", "-y", "-bd", `-o${into}`, path])],
  [
    /\.(rpm|zip|tar\.gz|tgz|tar\.zst|tar\.xz)$/i,
    (path, into) => runChecked("bsdtar", ["-xf", path, "-C", into]),
  ],
]

export async function unpack(path: string, into: string) {
  const unpacker = UNPACKERS.find(([pattern]) => pattern.test(path))
  if (!unpacker) throw new Error(`Nothing unpacks ${path}`)
  await mkdir(into, { recursive: true })
  await unpacker[1](path, into)
}

export async function rpmScripts(path: string) {
  return path.endsWith(".rpm") ? runChecked("rpm", ["-qp", "--scripts", "--nosignature", path]) : ""
}
