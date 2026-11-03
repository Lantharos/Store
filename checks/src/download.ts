import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

export async function download(url: string, directory: string, name: string, sha256?: string) {
  await mkdir(directory, { recursive: true })
  const path = join(directory, name)
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Downloading ${url} failed with ${response.status}`)
  const hash = createHash("sha256")
  const hashing = new Transform({
    transform(chunk: Buffer, _, callback) {
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body), hashing, createWriteStream(path))
  const digest = hash.digest("hex")
  if (sha256 && digest !== sha256) throw new Error(`${name} doesn't match its SHA-256`)
  return path
}
