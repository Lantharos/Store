import { run, runChecked } from "../run.ts"
import { compareDependencies, isLockfile, type Packages, readPackages } from "./dependencies.ts"
import { buildDigest, type ChangedFile, splitPatch } from "./digest.ts"

const LICENCE_FILE = /^(LICEN[CS]E|COPYING|UNLICENSE)([.-][A-Za-z0-9.]+)?$/i
const MAX_PATCH_BYTES = 8 * 1024 * 1024

export class Repository {
  private constructor(readonly directory: string) {}

  static async clone(repository: string, directory: string, commits: string[]) {
    const output = await run(
      "git",
      ["clone", "--quiet", "--bare", "--filter=blob:none", `https://github.com/${repository}.git`, directory],
      { timeoutSeconds: 600 },
    )
    if (output.code !== 0) return undefined
    await run("git", ["-C", directory, "fetch", "--quiet", "--filter=blob:none", "origin", ...commits], {
      timeoutSeconds: 600,
    })
    return new Repository(directory)
  }

  private git(...args: string[]) {
    return runChecked("git", ["-C", this.directory, ...args], { timeoutSeconds: 900 })
  }

  async show(revision: string, path: string) {
    const output = await run("git", ["-C", this.directory, "show", `${revision}:${path}`])
    return output.code === 0 ? output.stdout : undefined
  }

  async licenceFiles(revision: string) {
    const names = (await this.git("ls-tree", "--name-only", revision))
      .split("\n")
      .filter((name) => LICENCE_FILE.test(name))
    return Promise.all(names.map(async (path) => ({ path, text: (await this.show(revision, path)) ?? "" })))
  }

  private async packagesAt(revision: string, paths: string[]) {
    const all: Packages = new Map()
    for (const path of paths) {
      const text = await this.show(revision, path)
      if (text) for (const [name, version] of readPackages(path, text)) all.set(name, version)
    }
    return all
  }

  private async statuses(from: string, to: string) {
    const fields = (await this.git("diff", "--name-status", "-z", "-M", from, to)).split("\0")
    const statuses = new Map<string, string>()
    for (let index = 0; index < fields.length - 1; ) {
      const status = fields[index]!
      const renamed = status.startsWith("R") || status.startsWith("C")
      statuses.set(fields[index + (renamed ? 2 : 1)]!, status.charAt(0))
      index += renamed ? 3 : 2
    }
    return statuses
  }

  private async numstat(from: string, to: string, statuses: Map<string, string>) {
    const fields = (await this.git("diff", "--numstat", "-z", "-M", from, to)).split("\0")
    const files: ChangedFile[] = []
    for (let index = 0; index < fields.length - 1; ) {
      const [added, removed, path] = fields[index]!.split("\t") as [string, string, string]
      const target = path === "" ? fields[index + 2]! : path
      index += path === "" ? 3 : 1
      files.push({
        path: target,
        status: statuses.get(target) ?? "M",
        added: added === "-" ? 0 : Number(added),
        removed: removed === "-" ? 0 : Number(removed),
        binary: added === "-",
      })
    }
    return files
  }

  async diff(from: string, to: string) {
    const files = await this.numstat(from, to, await this.statuses(from, to))
    const patch = (await this.git("diff", "-M", from, to)).slice(0, MAX_PATCH_BYTES)
    const lockfiles = files.map((file) => file.path).filter(isLockfile)
    const dependencies = compareDependencies(
      await this.packagesAt(from, lockfiles),
      await this.packagesAt(to, lockfiles),
    )
    return { ...buildDigest(files, splitPatch(patch), dependencies), patch }
  }
}
