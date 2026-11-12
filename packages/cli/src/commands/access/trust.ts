import { SCHELF_WORKFLOW } from "@schelf/protocol"
import { type Args, flag } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, emit, field, note, title } from "../../ui/output.ts"
import { muted } from "../../ui/style.ts"
import { appOf, approve, needs, signedIn, verbs } from "../context.ts"

async function list(args: Args) {
  const context = await signedIn(args)
  const settings = await context.dashboard.app(await appOf(args))
  emit(settings.trusted_publishers)
  title(`Who may publish ${settings.app.id}`)
  if (!settings.trusted_publishers.length) note("No workflow yet.")
  for (const rule of settings.trusted_publishers)
    field(
      rule.id,
      `${rule.repository} ${rule.workflow}${rule.environment ? ` in ${rule.environment}` : ""}${rule.ref ? muted(` on ${rule.ref}`) : ""}`,
      20,
    )
  blank()
  return EXIT.ok
}

async function add(args: Args) {
  const repository = needs(
    args.positionals[0],
    "trust add <owner/repository> [--workflow <path>] [--environment <name>] [--ref <ref>]",
  )
  const context = await signedIn(args)
  const rule = {
    repository,
    workflow: flag(args, "workflow") ?? SCHELF_WORKFLOW,
    environment: flag(args, "environment"),
    ref: flag(args, "ref"),
  }
  return approve(context, [{ type: "trust.add", app: await appOf(args), rule }], args)
}

async function remove(args: Args) {
  const rule = needs(args.positionals[0], "trust remove <id>")
  const context = await signedIn(args)
  return approve(context, [{ type: "trust.remove", app: await appOf(args), rule }], args)
}

export const trust = verbs("trust", {
  list: { usage: "list", about: "The workflows trusted to publish", run: list },
  add: {
    usage: "add <owner/repository>",
    about: "Trust a workflow to publish (asks you, with a passkey)",
    run: add,
  },
  remove: { usage: "remove <id>", about: "Stop trusting one (asks you, with a passkey)", run: remove },
})
