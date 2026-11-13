import { readFile } from "node:fs/promises"
import { type Args, flag } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, done, emit, field, note, title } from "../../ui/output.ts"
import { link, muted } from "../../ui/style.ts"
import { approve, needs, publisherOf, signedIn, verbs } from "../context.ts"
import { whoami } from "../whoami.ts"

async function show(args: Args) {
  const context = await signedIn(args)
  const owner = await context.dashboard.publisher(publisherOf(context, args).id)
  emit(owner)
  title(owner.name)
  field("Page", link(`${context.api}/publishers/${owner.slug}`))
  field("Kind", owner.kind === "person" ? "personal" : "organisation")
  field("Verified", owner.verified ? "yes" : "no")
  if (owner.description) field("About", owner.description)
  if (owner.website) field("Website", owner.website)
  blank()
  return EXIT.ok
}

async function create(args: Args) {
  const name = needs(args.positionals.join(" ") || undefined, "publisher create <name> [--organisation]")
  const context = await signedIn(args)
  const kind = args.flags.has("organisation") ? "organisation" : "person"
  return approve(context, [{ type: "publisher.create", kind, name }], args)
}

async function update(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const name = flag(args, "name")
  const slug = flag(args, "slug")
  const description = flag(args, "description")
  const website = flag(args, "website")
  const logo = flag(args, "logo")
  if (description !== undefined || website !== undefined) {
    emit(
      await context.dashboard.updatePublisher(owner.id, {
        description,
        website: website === "" ? null : website,
      }),
    )
    done("Updated the profile")
  }
  if (logo) {
    await context.dashboard.putLogo(owner.id, new Uint8Array(await readFile(logo)))
    done("Updated the logo")
  }
  if (name || slug)
    return approve(context, [{ type: "publisher.rename", publisher: owner.id, name, slug }], args)
  return EXIT.ok
}

async function domain(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const wanted = args.positionals[0]
  if (wanted || args.flags.has("remove"))
    return approve(
      context,
      [{ type: "publisher.domain", publisher: owner.id, domain: args.flags.has("remove") ? null : wanted! }],
      args,
    )
  const state = args.flags.has("check")
    ? await context.dashboard.checkPublisherDomain(owner.id)
    : await context.dashboard.publisherDomain(owner.id)
  emit(state)
  if (!state) {
    note("No download domain. Connect one with schelf publisher domain dl.example.com.")
    return EXIT.ok
  }
  title(state.domain)
  field("Status", state.waiting ?? state.status)
  if (state.status !== "active")
    for (const record of state.records) field(record.type, `${record.name} ${muted("→")} ${record.value}`)
  blank()
  return EXIT.ok
}

export const publisher = verbs("publisher", {
  list: { usage: "list", about: "The publishers you belong to", run: whoami },
  show: { usage: "show [--publisher <slug>]", about: "Its public page and profile", run: show },
  create: {
    usage: "create <name> [--organisation]",
    about: "Make a publisher (asks you in the browser)",
    run: create,
  },
  domain: {
    usage: "domain [<domain>] [--check] [--remove]",
    about: "A domain for all its download links; connecting or removing one asks you in the browser",
    run: domain,
  },
  update: {
    usage: "update [--description] [--website] [--logo <file>] [--name] [--slug]",
    about: "Change the profile; a new name or address asks you in the browser",
    run: update,
  },
})
