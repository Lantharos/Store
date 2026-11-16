export interface Entry {
  path: string
  size: number
  setuid: boolean
}

const LONG_LISTING = /^(-[rwxsStT-]{9})\S*\s+\S+\s+(\d+)\s+\S+\s+\S+\s(.+)$/
const UNIX_MODE = /\s(-[rwxsStT-]{9})$/
const MTREE_ESCAPE = /\\([0-7]{3})/g
const SPECIAL_BITS = 0o6000

const setsIds = (mode: string) => /[sS]/.test(mode[3]!) || /[sS]/.test(mode[6]!)
const withinRoot = (path: string) => path.replace(/^\.?\//, "")

export function fromLongListing(text: string): Entry[] {
  return text.split("\n").flatMap((line) => {
    const match = LONG_LISTING.exec(line)
    if (!match) return []
    const [, mode, size, path] = match
    return [{ path: withinRoot(path!), size: Number(size), setuid: setsIds(mode!) }]
  })
}

const unescapeMtree = (name: string) =>
  Buffer.from(
    name.replace(MTREE_ESCAPE, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8))),
    "latin1",
  ).toString("utf8")

export function fromMtree(text: string): Entry[] {
  return text.split("\n").flatMap((line) => {
    if (!line || line.startsWith("#")) return []
    const [name, ...keywords] = line.split(" ")
    const fields = new Map(keywords.map((keyword) => keyword.split("=", 2) as [string, string]))
    if (fields.get("type") !== "file") return []
    const mode = Number.parseInt(fields.get("mode") ?? "0", 8)
    return [
      {
        path: withinRoot(unescapeMtree(name!)),
        size: Number(fields.get("size") ?? 0),
        setuid: (mode & SPECIAL_BITS) !== 0,
      },
    ]
  })
}

export function from7zListing(text: string): Entry[] {
  const entries = text.slice(text.indexOf("\n----------\n") + 1)
  return entries.split(/\n\s*\n/).flatMap((block) => {
    const fields = new Map(
      block.split("\n").map((line) => {
        const at = line.indexOf(" = ")
        return [line.slice(0, at), line.slice(at + 3)] as const
      }),
    )
    const path = fields.get("Path")
    if (!path || fields.get("Folder") === "+") return []
    const mode = UNIX_MODE.exec(fields.get("Attributes") ?? "")?.[1]
    return [{ path, size: Number(fields.get("Size") ?? 0), setuid: mode !== undefined && setsIds(mode) }]
  })
}

export function fromMsiFileTable(text: string): Entry[] {
  return text
    .split(/\r?\n/)
    .slice(3)
    .flatMap((line) => {
      const [, , name, size] = line.split("\t")
      return name && size ? [{ path: name, size: Number(size), setuid: false }] : []
    })
}
