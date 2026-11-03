import { parse } from "smol-toml"

export interface ExtensionManifest {
  id: string
  name: string
  version?: string
  summary?: string
  api: number
}

interface ExtensionFile {
  id?: string
  name?: string
  version?: string
  summary?: string
  description?: string
  api?: number
  extension?: ExtensionFile
}

export function readExtension(text: string): ExtensionManifest {
  const file = parse(text) as ExtensionFile
  const table = file.extension ?? file
  if (!table.id || !table.name) throw new Error("extension.toml needs an id and a name")
  if (typeof table.api !== "number")
    throw new Error("extension.toml needs the extension API version it targets")
  return {
    id: table.id,
    name: table.name,
    version: table.version,
    summary: table.summary ?? table.description,
    api: table.api,
  }
}
