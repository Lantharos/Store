import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { TreeFile } from "./tree.ts"

const SYSTEM_SCHEMAS = "/usr/share/glib-2.0/schemas"
const SCHEMA_FILE = /\.gschema\.xml$/
const SCHEMA_ID = /<schema\b[^>]*\bid="([^"]+)"/g

async function idsIn(path: string) {
  const text = await readFile(path, "utf8")
  return [...text.matchAll(SCHEMA_ID)].map((match) => match[1]!)
}

/** GSettings schema ids the app ships or the desktop provides; they look like bus names but aren't. */
export async function settingsSchemas(files: TreeFile[]) {
  const system = (await readdir(SYSTEM_SCHEMAS).catch(() => []))
    .filter((name) => SCHEMA_FILE.test(name))
    .map((name) => join(SYSTEM_SCHEMAS, name))
  const shipped = files.filter((file) => SCHEMA_FILE.test(file.path)).map((file) => file.absolute)
  const ids = await Promise.all([...system, ...shipped].map(idsIn))
  return new Set(ids.flat())
}
