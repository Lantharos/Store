import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { API_BASE, downloadUrl, paths } from "@schelf/protocol"
import { githubOidcToken, mapLimit, request } from "@schelf/publisher"

export interface Icon {
  id: string
  file: string
}

const HASH_LENGTH = 16

export async function hostIcons(options: {
  api: string
  directory: string
  icons: Icon[]
  known: Set<string>
}): Promise<Map<string, string>> {
  const hosted = new Map<string, string>()
  let token: string | undefined
  let uploaded = 0
  await mapLimit(options.icons, 8, async (icon) => {
    const bytes = await readFile(join(options.directory, icon.file)).catch(() => undefined)
    if (!bytes) return
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LENGTH)
    const key = paths.media(icon.id, hash, "png")
    if (!options.known.has(downloadUrl(key))) {
      token ??= await githubOidcToken()
      await request(`${options.api}${API_BASE}/mirror/media/${encodeURIComponent(icon.id)}/${hash}.png`, {
        method: "PUT",
        token,
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
