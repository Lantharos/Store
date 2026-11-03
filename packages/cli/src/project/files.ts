import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

const SKIPPED = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  ".git",
  "vendor",
  ".svelte-kit",
  ".next",
  "out",
])
const MAX_DEPTH = 4

export async function findFiles(root: string, matches: (name: string) => boolean): Promise<string[]> {
  const found: string[] = []
  const walk = async (directory: string, depth: number) => {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          if (depth < MAX_DEPTH && !SKIPPED.has(entry.name) && !entry.name.startsWith("."))
            await walk(path, depth + 1)
        } else if (matches(entry.name)) {
          found.push(relative(root, path))
        }
      }),
    )
  }
  await walk(root, 0)
  return found.sort(
    (left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right),
  )
}

export async function readOptional(path: string) {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}
