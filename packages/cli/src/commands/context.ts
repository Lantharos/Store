import { readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  type Account,
  type ApprovalAction,
  manifestName,
  readSchelfToml,
  SCHELF_TOML,
} from "@schelf/protocol"
import { askApproval } from "../api/approvals.ts"
import { session } from "../api/auth.ts"
import { type Dashboard, dashboard } from "../api/dashboard.ts"
import { type Args, apiOrigin, flag } from "../args.ts"
import { repositoryRoot } from "../project/git.ts"
import { EXIT } from "../ui/exit.ts"
import { Failure, field, title } from "../ui/output.ts"

export interface Context {
  api: string
  token: string
  me: Account
  dashboard: Dashboard
}

export async function signedIn(args: Args): Promise<Context> {
  const api = apiOrigin(args)
  const { token, account } = await session(api)
  return { api, token, me: account, dashboard: dashboard(api, token) }
}

export async function appOf(args: Args) {
  const given = flag(args, "app")
  if (given) return given
  const config = flag(args, "config") ?? join(await repositoryRoot(process.cwd()), SCHELF_TOML)
  const text = await readFile(config, "utf8").catch(() => {
    throw new Failure(
      "There's no schelf.toml here",
      "Run this in the app's repository, or pass --app <id>.",
      EXIT.usage,
    )
  })
  return manifestName(readSchelfToml(text))
}

export function publisherOf(context: Context, args: Args) {
  const wanted = flag(args, "publisher")
  const publishers = context.me.publishers
  const found = wanted
    ? publishers.find((publisher) => publisher.slug === wanted || publisher.id === wanted)
    : publishers.length === 1
      ? publishers[0]
      : undefined
  if (found) return found
  throw wanted
    ? new Failure(`You aren't a member of ${wanted}`, "schelf whoami lists your publishers.", EXIT.usage)
    : new Failure("Say which publisher", "Pass --publisher <slug>; schelf whoami lists them.", EXIT.usage)
}

export async function findRelease(account: Dashboard, id: string, version: string | undefined) {
  const releases = await account.releases(id)
  const found = version
    ? releases.find((release) => release.version === version.replace(/^v/, ""))
    : releases[0]
  if (found) return found
  throw version
    ? new Failure(`${id} has no release ${version}`, undefined, EXIT.usage)
    : new Failure(`${id} has no releases yet`, "Publish a GitHub release to send the first one.")
}

export async function approve(context: Context, actions: ApprovalAction[], args: Args) {
  return (await askApproval(context.api, context.token, actions, args)).code
}

export function needs(value: string | undefined, usage: string): string {
  if (!value) throw new Failure(`Usage: schelf ${usage}`, undefined, EXIT.usage)
  return value
}

type Verb = { usage: string; about: string; run: (args: Args) => Promise<number> }

export function verbs(noun: string, table: Record<string, Verb>) {
  return async (args: Args) => {
    const verb = args.positionals.shift()
    const entry = verb ? table[verb] : undefined
    if (entry) return entry.run(args)
    title(`schelf ${noun}`)
    const width = Math.max(...Object.values(table).map((each) => each.usage.length)) + 4
    for (const each of Object.values(table)) field(`${noun} ${each.usage}`, each.about, width + noun.length)
    if (verb) throw new Failure(`There's no schelf ${noun} ${verb}`, undefined, EXIT.usage)
    return EXIT.usage
  }
}

export const usage = (noun: string, table: Record<string, Verb>) =>
  `${noun} <${Object.keys(table).join("|")}>`
