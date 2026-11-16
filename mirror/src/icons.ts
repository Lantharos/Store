import { readFile } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { API_BASE, downloadUrl, paths, sha256Hex } from "@schelf/protocol"
import { githubOidcToken, mapLimit, request } from "@schelf/runner"

export interface Icon {
  id: string
  file: string
}

const HASH_LENGTH = 16

export function iconPath(directory: string, file: string) {
  const root = resolve(directory)
  const path = resolve(root, file)
  return path.startsWith(`${root}${sep}`) ? path : undefined
}

export async function hostIcons(options: {
  api: string
  directory: string
  icons: Icon[]
  known: Set<string>
}): Promise<Map<string, string>> {
  const hosted = new Map<string, string>()
  let token: Promise<string> | undefined
  let uploaded = 0
  await mapLimit(options.icons, 8, async (icon) => {
    const path = iconPath(options.directory, icon.file)
    const bytes = path && (await readFile(path).catch(() => undefined))
    if (!bytes) return
    const hash = (await sha256Hex(bytes)).slice(0, HASH_LENGTH)
    const key = paths.media(icon.id, hash, "png")
    if (!options.known.has(downloadUrl(key))) {
      token ??= githubOidcToken()
      await request(`${options.api}${API_BASE}/mirror/media/${encodeURIComponent(icon.id)}/${hash}.png`, {
        method: "PUT",
        token: await token,
        body: bytes,
        headers: { "content-type": "image/png" },
      })
      uploaded++
    }
    hosted.set(icon.id, downloadUrl(key))
  })
  console.log(`Fedora icons: ${hosted.size} hosted, ${uploaded} new`)
  return hosted
}
