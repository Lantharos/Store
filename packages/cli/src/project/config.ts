import { access } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { SCHELF_TOML } from "@schelf/protocol"
import { type Args, flag } from "../args.ts"
import { repositoryRoot } from "./git.ts"

export interface ConfigPlace {
  root: string
  config: string
  folder: string
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  )

async function nearest(from: string, root: string) {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, SCHELF_TOML)
    if (await exists(candidate)) return candidate
    if (directory === root || directory === dirname(directory)) return join(root, SCHELF_TOML)
  }
}

/** The schelf.toml a command works on: --config, or the nearest one from here up to the repository root. */
export async function configPlace(args: Args): Promise<ConfigPlace> {
  const root = await repositoryRoot(process.cwd())
  const given = flag(args, "config")
  const config = given ? resolve(given) : await nearest(process.cwd(), root)
  return { root, config, folder: dirname(config) }
}
