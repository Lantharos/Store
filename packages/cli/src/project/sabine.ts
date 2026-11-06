import { parse } from "smol-toml"

export interface SabineSandbox {
  network?: boolean
  filesystems?: string[]
  devices?: string[]
  talk?: string[]
  unsandboxed?: boolean
  reason?: string
}

export interface SabineApp {
  id: string
  name: string
  version?: string
  description?: string
  icon?: string
  sandbox?: SabineSandbox
  updatesProvider?: string
}

interface SabineFile {
  app?: { id?: string; name?: string; version?: string; description?: string; icon?: string }
  sandbox?: SabineSandbox
  updates?: { provider?: string }
}

export function readSabine(text: string): SabineApp {
  const file = parse(text) as SabineFile
  const { id, name } = file.app ?? {}
  if (!id || !name) throw new Error("Sabine.toml needs [app] id and name")
  return {
    id,
    name,
    version: file.app?.version,
    description: file.app?.description,
    icon: file.app?.icon,
    sandbox: file.sandbox,
    updatesProvider: file.updates?.provider,
  }
}

const tableHeader = /^\s*\[([^\]]+)\]\s*(#.*)?$/
const replacedKeys = /^\s*(provider|repository|url|public_key)\s*=/

export function followSchelfUpdates(text: string): string {
  const lines = text.split("\n")
  const start = lines.findIndex((line) => tableHeader.exec(line)?.[1]?.trim() === "updates")
  if (start === -1) {
    const trimmed = text.replace(/\n*$/, "")
    return `${trimmed}\n\n[updates]\nprovider = "schelf"\n`
  }
  const nextTable = lines.findIndex((line, index) => index > start && tableHeader.test(line))
  const end = nextTable === -1 ? lines.length : nextTable
  const body = lines.slice(start + 1, end).filter((line) => !replacedKeys.test(line))
  return [...lines.slice(0, start + 1), 'provider = "schelf"', ...body, ...lines.slice(end)].join("\n")
}
