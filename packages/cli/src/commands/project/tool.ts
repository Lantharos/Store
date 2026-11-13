import type { ProjectTool, PublisherTool } from "@schelf/protocol"
import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, emit, field, note, title } from "../../ui/output.ts"
import { muted } from "../../ui/style.ts"
import { approve, needs, publisherOf, signedIn, verbs } from "../context.ts"

const SHORT: Record<ProjectTool["short"], string> = {
  resolves: "answers to its bare name",
  paused: "its bare name waits until the publisher is verified again",
  free: "its bare name is free to claim",
  taken: "another publisher has its bare name",
  reserved: "its bare name is kept for the system",
}

export function printTool(tool: ProjectTool) {
  field(tool.address, muted(SHORT[tool.short]))
  note(`  ${tool.install}`)
  note(`  ${tool.add}`)
}

async function list(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const tools: PublisherTool[] = await context.dashboard.tools(owner.id)
  emit(tools)
  title(`Tools of ${owner.name}`)
  if (!tools.length) note('None yet. Set tool = "<program>" in schelf.toml and run schelf apply.')
  for (const tool of tools) printTool(tool)
  blank()
  return EXIT.ok
}

async function name(args: Args) {
  const wanted = needs(args.positionals[0], "tool name <name>")
  const context = await signedIn(args)
  return approve(
    context,
    [{ type: "tool.name", publisher: publisherOf(context, args).id, name: wanted }],
    args,
  )
}

export const tool = verbs("tool", {
  list: {
    usage: "list [--publisher <slug>]",
    about: "Your tools and the lines that install them",
    run: list,
  },
  name: {
    usage: "name <name>",
    about: "Let your tool answer to its bare name, for verified publishers (asks you in the browser)",
    run: name,
  },
})
