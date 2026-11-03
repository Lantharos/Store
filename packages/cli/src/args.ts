import { STORE_ORIGIN } from "@schelf/protocol"

export interface Args {
  positionals: string[]
  flags: Map<string, string | true>
}

export function parseArgs(argv: string[]): Args {
  const positionals: string[] = []
  const flags = new Map<string, string | true>()
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!
    if (argument === "--") {
      positionals.push(...argv.slice(index + 1))
      break
    }
    if (!argument.startsWith("-") || argument === "-") {
      positionals.push(argument)
      continue
    }
    const [name, inline] = argument.replace(/^--?/, "").split(/=(.*)/s, 2) as [string, string | undefined]
    if (inline !== undefined) flags.set(name, inline)
    else if (argv[index + 1] !== undefined && !argv[index + 1]!.startsWith("-") && VALUED.has(name))
      flags.set(name, argv[++index]!)
    else flags.set(name, true)
  }
  return { positionals, flags }
}

const VALUED = new Set([
  "api",
  "token",
  "version",
  "notes",
  "config",
  "workflow",
  "id",
  "name",
  "publisher",
  "channel",
])

export function flag(args: Args, name: string) {
  const value = args.flags.get(name)
  return typeof value === "string" ? value : undefined
}

export const apiOrigin = (args: Args) =>
  (flag(args, "api") ?? process.env.SCHELF_API ?? STORE_ORIGIN).replace(/\/$/, "")
