import { parse } from "smol-toml"

export interface ExtensionManifest {
  id: string
  name: string
  version?: string
  summary?: string
  api: number
  helper?: string
}

interface ExtensionFile {
  id?: string
  name?: string
  version?: string
  description?: string
  api?: number
  helper?: { path?: string }
}

export function readExtension(text: string): ExtensionManifest {
  const file = parse(text) as ExtensionFile
  if (!file.id || !file.name) throw new Error("extension.toml needs an id and a name")
  if (typeof file.api !== "number")
    throw new Error("extension.toml needs the extension API version it targets")
  if (file.helper && !file.helper.path)
    throw new Error("extension.toml's [helper] needs the path of its program")
  return {
    id: file.id,
    name: file.name,
    version: file.version,
    summary: file.description,
    api: file.api,
    helper: file.helper?.path,
  }
}
