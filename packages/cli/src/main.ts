#!/usr/bin/env node
import process from "node:process"
import { describeIssue, STORE_ORIGIN } from "@schelf/protocol"
import { ApiFailure, ArtifactError, ConfigError } from "@schelf/publisher"
import { ZodError } from "zod"
import { version } from "../package.json"
import { type Args, parseArgs } from "./args.ts"
import { token } from "./commands/access/token.ts"
import { trust } from "./commands/access/trust.ts"
import { apply } from "./commands/apply.ts"
import { check } from "./commands/check.ts"
import { init } from "./commands/init.ts"
import { listing } from "./commands/listing.ts"
import { login, logout } from "./commands/login.ts"
import { invite } from "./commands/people/invite.ts"
import { member } from "./commands/people/member.ts"
import { namespace } from "./commands/people/namespace.ts"
import { publisher } from "./commands/people/publisher.ts"
import { verification } from "./commands/people/verification.ts"
import { channel } from "./commands/project/channel.ts"
import { project } from "./commands/project/project.ts"
import { release } from "./commands/project/release.ts"
import { publish } from "./commands/publish.ts"
import { request } from "./commands/request.ts"
import { rollout } from "./commands/rollout.ts"
import { status } from "./commands/status.ts"
import { whoami } from "./commands/whoami.ts"
import { EXIT } from "./ui/exit.ts"
import { blank, emit, Failure, failure, field, note, printJson, title } from "./ui/output.ts"
import { withoutPrompts } from "./ui/style.ts"

const COMMANDS: Record<
  string,
  { run: (args: Args) => Promise<number | undefined>; usage: string; about: string }
> = {
  init: {
    run: init,
    usage: "init [--publisher <slug>] [--id <app id>]",
    about: "Set up this app, extension or project for Schelf",
  },
  check: {
    run: check,
    usage: "check",
    about: "Check schelf.toml and the listing, and preview the store page",
  },
  apply: {
    run: apply,
    usage: "apply [--dry-run]",
    about: "Make the store match schelf.toml and the listing folder",
  },
  publish: {
    run: publish,
    usage: "publish [files…] [--channel <name>] [--version <version>]",
    about: "Publish a release: from GitHub Actions, with a token, or signed in (goes to review)",
  },
  status: {
    run: status,
    usage: "status [version]",
    about: "What's happening: releases in flight, what checks flagged, what waits on you",
  },
  rollout: {
    run: rollout,
    usage: "rollout <version> <change>",
    about: "Set a percentage, pause, resume or release to all",
  },
  project: {
    run: project,
    usage: "project <list|show|domain|stats|rename|delete|restore>",
    about: "The project and its settings",
  },
  release: { run: release, usage: "release <list|show|promote|rollback|inside-luft>", about: "Releases" },
  channel: {
    run: channel,
    usage: "channel <list|people|invite|uninvite|token|revoke>",
    about: "Channels, and who gets an invite-only one",
  },
  listing: { run: listing, usage: "listing pull", about: "Bring the store page into listing.toml" },
  trust: { run: trust, usage: "trust <list|add|remove>", about: "Workflows trusted to publish" },
  token: { run: token, usage: "token <list|create|revoke>", about: "Upload tokens" },
  publisher: {
    run: publisher,
    usage: "publisher <list|show|create|update|domain>",
    about: "Publishers and their profiles",
  },
  member: {
    run: member,
    usage: "member <list|invite|role|remove|transfer|leave>",
    about: "Organisation members",
  },
  invite: { run: invite, usage: "invite <list|accept|decline|revoke>", about: "Invitations" },
  namespace: {
    run: namespace,
    usage: "namespace <list|claim|verify|release>",
    about: "Namespaces app ids live under",
  },
  verification: { run: verification, usage: "verification status", about: "The publisher's verified mark" },
  request: {
    run: request,
    usage: "request <status|cancel> <id>",
    about: "Check on, wait for or cancel something waiting for your approval",
  },
  login: { run: login, usage: "login", about: "Sign in through the browser" },
  whoami: { run: whoami, usage: "whoami", about: "The account you're signed in as and its publishers" },
  logout: { run: logout, usage: "logout", about: "Forget this computer's sign-in" },
}

function help() {
  title("schelf")
  const commands = Object.values(COMMANDS)
  const width = Math.max(...commands.map((command) => command.usage.length)) + 2
  for (const command of commands) field(command.usage, command.about, width)
  blank()
  note(
    "Everywhere: --json prints the result as JSON, --yes never asks, --api <origin> talks to another store",
  )
  note("Exits 0 when done, 1 on failure, 2 for wrong usage, 3 when not signed in,")
  note(`4 while waiting for a person, 5 when declined or expired. More at ${STORE_ORIGIN}/docs/cli`)
  blank()
  return 0
}

function report(error: unknown) {
  if (error instanceof Failure) {
    failure(error.message)
    if (error.hint) note(error.hint)
    emit({ error: error.message, hint: error.hint ?? null })
    return error.code
  }
  if (error instanceof ConfigError || (error instanceof ApiFailure && error.config.length)) {
    const issues = error instanceof ConfigError ? error.issues : (error as ApiFailure).config
    for (const issue of issues) failure(describeIssue(issue))
    emit({ error: error.message, issues })
    return EXIT.failed
  }
  emit({ error: error instanceof ApiFailure ? error.detail : String((error as Error).message ?? error) })
  if (error instanceof ApiFailure) {
    failure(error.detail)
    if (error.status === 401) return EXIT.signIn
  } else if (error instanceof ZodError) {
    for (const issue of error.issues) failure(`${issue.path.join(".") || "schelf.toml"}: ${issue.message}`)
  } else if (error instanceof ArtifactError || error instanceof Error) {
    failure(error.message)
  } else {
    failure(String(error))
  }
  return EXIT.failed
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.flags.has("json")) {
    printJson()
    withoutPrompts()
  }
  if (args.flags.has("yes")) withoutPrompts()
  if (args.flags.get("version") === true) {
    console.log(version)
    return 0
  }
  const name = args.positionals.shift()
  if (!name || args.flags.has("help") || args.flags.has("h")) return help()
  const command = COMMANDS[name]
  if (!command) {
    failure(`There's no ${name} command`)
    help()
    return EXIT.usage
  }
  try {
    return (await command.run(args)) ?? EXIT.ok
  } catch (error) {
    const code = report(error)
    blank()
    return code
  }
}

process.exitCode = await main()
