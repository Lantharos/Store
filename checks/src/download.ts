import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { sha256File } from "@schelf/runner"

export async function download(url: string, directory: string, name: string, sha256: string) {
  await mkdir(directory, { recursive: true })
  const path = join(directory, name)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Downloading ${url} failed with ${response.status}`)
  await Bun.write(path, response)
  if ((await sha256File(path)) !== sha256) throw new Error(`${name} doesn't match its SHA-256`)
  return path
}
