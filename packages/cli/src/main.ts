#!/usr/bin/env node
import process from "node:process"
import { ApiFailure, ArtifactError } from "@schelf/publisher"
import { ZodError } from "zod"
import { type Args, parseArgs } from "./args.ts"
import { check } from "./commands/check.ts"
import { init } from "./commands/init.ts"
import { login, logout } from "./commands/login.ts"
import { publish } from "./commands/publish.ts"
import { rollout } from "./commands/rollout.ts"
import { status } from "./commands/status.ts"
import { whoami } from "./commands/whoami.ts"
import { blank, Failure, failure, field, note, title } from "./ui/output.ts"

const COMMANDS: Record<
  string,
  { run: (args: Args) => Promise<number | undefined>; usage: string; about: string }
> = {
  init: { run: init, usage: "init [--publisher <slug>]", about: "Set up this app or extension for Schelf" },
  check: { run: check, usage: "check", about: "Check schelf.toml and preview the store page" },
  publish: { run: publish, usage: "publish [files…]", about: "Publish a release from CI or with a token" },
  status: { run: status, usage: "status [version]", about: "Where a release is: checks, review, rollout" },
  rollout: {
    run: rollout,
    usage: "rollout <version> <change>",
    about: "Set a percentage, pause, resume or release to all",
  },
  login: { run: login, usage: "login", about: "Sign in through the browser" },
  whoami: { run: whoami, usage: "whoami", about: "The account you're signed in as and its publishers" },
  logout: { run: logout, usage: "logout", about: "Forget this computer's sign-in" },
}

function help() {
  title("schelf")
  for (const command of Object.values(COMMANDS)) field(command.usage, command.about, 30)
  blank()
  note("Options: --api <origin> to use another store, --token <token> for publish outside GitHub Actions")
  blank()
  return 0
}

function report(error: unknown) {
  if (error instanceof Failure) {
    failure(error.message)
    if (error.hint) note(error.hint)
  } else if (error instanceof ApiFailure) {
    failure(error.detail)
  } else if (error instanceof ZodError) {
    for (const issue of error.issues) failure(`${issue.path.join(".") || "schelf.toml"}: ${issue.message}`)
  } else if (error instanceof ArtifactError || error instanceof Error) {
    failure(error.message)
  } else {
    failure(String(error))
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.flags.has("version")) {
    console.log(process.env.SCHELF_CLI_VERSION)
    return 0
  }
  const name = args.positionals.shift()
  if (!name || args.flags.has("help") || args.flags.has("h")) return help()
  const command = COMMANDS[name]
  if (!command) {
    failure(`There's no ${name} command`)
    return help() + 1
  }
  try {
    return (await command.run(args)) ?? 0
  } catch (error) {
    report(error)
    blank()
    return 1
  }
}

process.exitCode = await main()
