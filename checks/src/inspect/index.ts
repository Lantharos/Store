import { readFile } from "node:fs/promises"
import { parseMetainfo } from "@schelf/appstream"
import type { Permissions } from "@schelf/protocol"
import { INSTALL_SCRIPTS } from "../unpack/index.ts"
import { linkedLibraries } from "./libraries.ts"
import { comparePermissions } from "./permissions.ts"
import { settingsSchemas } from "./schemas.ts"
import { scanStrings } from "./strings.ts"
import { walkTree } from "./tree.ts"

const BUNDLED_METAINFO = /(^|\/)share\/(metainfo|appdata)\/[^/]+\.xml$/

async function bundledLicence(files: { path: string; absolute: string }[]) {
  const file = files.find((candidate) => BUNDLED_METAINFO.test(candidate.path))
  if (!file) return null
  try {
    return parseMetainfo(await readFile(file.absolute, "utf8")).projectLicense ?? null
  } catch {
    return null
  }
}

export async function inspectArtifact(root: string, declared: Permissions | null, setuid: string[]) {
  const files = await walkTree(root, new Set(setuid))
  const [libraries, found, schemas] = await Promise.all([
    linkedLibraries(files),
    scanStrings(files),
    settingsSchemas(files),
  ])
  const strings = { ...found, busNames: found.busNames.filter((name) => !schemas.has(name.value)) }
  return {
    files: files.length,
    bytes: files.reduce((total, file) => total + file.size, 0),
    executables: files
      .filter((file) => file.kind !== "other")
      .map((file) => ({ path: file.path, kind: file.kind })),
    setuid: files.filter((file) => file.setuid).map((file) => file.path),
    installScripts: files.filter((file) => INSTALL_SCRIPTS.test(file.path)).map((file) => file.path),
    libraries,
    strings,
    permissions: comparePermissions(declared, { libraries, strings, files }),
    licence: await bundledLicence(files),
  }
}

export type Inspection = Awaited<ReturnType<typeof inspectArtifact>>
