import { mapLimit } from "@schelf/publisher"
import { run } from "../run.ts"
import type { TreeFile } from "./tree.ts"

const ELF_NEEDED = /\(NEEDED\)\s+Shared library: \[([^\]]+)\]/g
const PE_IMPORT = /DLL Name: (\S+)/g
const MACHO_DYLIB = /cmd LC_(?:LOAD|LOAD_WEAK|REEXPORT)_DYLIB[\s\S]*?name (\S+)/g

async function librariesOf(file: TreeFile) {
  if (file.kind === "elf") {
    const { stdout } = await run("readelf", ["-d", "--wide", file.absolute])
    return [...stdout.matchAll(ELF_NEEDED)].map((match) => match[1]!)
  }
  const { stdout } = await run("objdump", ["-p", file.absolute])
  const pattern = file.kind === "pe" ? PE_IMPORT : MACHO_DYLIB
  return [...stdout.matchAll(pattern)].map((match) => match[1]!)
}

export async function linkedLibraries(files: TreeFile[]) {
  const binaries = files.filter((file) => file.kind === "elf" || file.kind === "pe" || file.kind === "macho")
  const found = await mapLimit(binaries, 8, async (file) => ({
    file: file.path,
    libraries: await librariesOf(file),
  }))
  return found.filter((entry) => entry.libraries.length)
}
