import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)

export interface Repository {
  owner: string
  name: string
}

const GITHUB_REMOTE = /github\.com[:/]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/

export function parseRemote(url: string): Repository | undefined {
  const match = GITHUB_REMOTE.exec(url.trim())
  return match ? { owner: match[1]!, name: match[2]! } : undefined
}

export async function git(root: string, ...args: string[]) {
  const { stdout } = await run("git", args, { cwd: root })
  return stdout.trim()
}

export async function githubRepository(root: string): Promise<Repository | undefined> {
  const remotes = await git(root, "remote").catch(() => "")
  const names = remotes.split("\n").filter(Boolean)
  for (const remote of ["origin", ...names.filter((name) => name !== "origin")]) {
    if (!names.includes(remote)) continue
    const repository = parseRemote(await git(root, "remote", "get-url", remote))
    if (repository) return repository
  }
  return undefined
}

export async function repositoryRoot(directory: string) {
  return git(directory, "rev-parse", "--show-toplevel").catch(() => directory)
}
