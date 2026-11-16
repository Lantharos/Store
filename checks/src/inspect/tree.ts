import { lstat, open, readdir } from "node:fs/promises"
import { join, relative } from "node:path"

export type FileKind = "elf" | "pe" | "macho" | "script" | "other"

export interface TreeFile {
  path: string
  absolute: string
  size: number
  kind: FileKind
  setuid: boolean
}

function kindOf(magic: Buffer): FileKind {
  if (magic.readUInt32BE(0) === 0x7f454c46) return "elf"
  if (magic.readUInt16BE(0) === 0x4d5a) return "pe"
  const word = magic.readUInt32BE(0)
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(word)) return "macho"
  if (magic.readUInt16BE(0) === 0x2321) return "script"
  return "other"
}

async function magicOf(path: string, size: number) {
  if (size < 4) return "other"
  const file = await open(path)
  try {
    const magic = Buffer.alloc(4)
    await file.read(magic, 0, 4, 0)
    return kindOf(magic)
  } finally {
    await file.close()
  }
}

export async function walkTree(root: string, setuid: Set<string>): Promise<TreeFile[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile())
  return Promise.all(
    files.map(async (entry) => {
      const absolute = join(entry.parentPath, entry.name)
      const path = relative(root, absolute)
      const { size } = await lstat(absolute)
      return { path, absolute, size, kind: await magicOf(absolute, size), setuid: setuid.has(path) }
    }),
  )
}
