import { PROJECT_GROUPS } from "@schelf/protocol"
import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, emit, field, note, title } from "../../ui/output.ts"
import { link, muted } from "../../ui/style.ts"
import { appOf, approve, needs, publisherOf, signedIn, verbs } from "../context.ts"
import { printTool } from "./tool.ts"

async function list(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const [apps, deleted] = await Promise.all([
    context.dashboard.apps(owner.id),
    context.dashboard.deletedApps(owner.id),
  ])
  emit({ apps, deleted })
  title(`Projects of ${owner.name}`)
  if (!apps.length) note("None yet. schelf init sets one up.")
  for (const { label, group } of PROJECT_GROUPS) {
    const listed = apps.filter((app) => app.group === group)
    if (!listed.length) continue
    title(label)
    for (const app of listed)
      field(
        app.id,
        `${app.name} ${muted(`${app.visibility} · ${app.version ?? "no release"} · ${app.installs_7d} installs this week`)}`,
        32,
      )
  }
  for (const app of deleted)
    field(app.id, muted(`deleted, restorable until ${app.restorable_until.slice(0, 10)}`), 32)
  blank()
  return EXIT.ok
}

async function show(args: Args) {
  const context = await signedIn(args)
  const settings = await context.dashboard.app(await appOf(args))
  emit(settings)
  title(`${settings.app.name} ${muted(settings.app.id)}`)
  field("Address", `${settings.app.publisher_slug}/${settings.app.slug}`)
  field("Visibility", settings.app.visibility)
  field(
    "Format",
    `${settings.app.format}${settings.app.updater ? `, updates with ${settings.app.updater}` : ""}`,
  )
  if (settings.app.platforms) field("Systems", settings.app.platforms.join(", "))
  for (const [name, part] of Object.entries(settings.app.parts))
    field("Part", `${name} for ${part.platforms.join(", ")} ${muted(`${settings.links.latest}/${name}`)}`)
  for (const each of settings.tools) printTool(each)
  field("Page", link(settings.links.page))
  field("Latest", link(settings.links.latest))
  for (const feed of settings.links.feeds)
    field("Feed", `${link(feed.url)}${feed.part ? ` ${muted(`for ${feed.part}`)}` : ""}`)
  for (const channel of settings.channels)
    field(
      "Channel",
      `${channel.name}${channel.keep ? `, keeps ${channel.keep}` : ""}${channel.ended_into ? `, ended into ${channel.ended_into}` : ""}`,
    )
  field(
    "Files",
    settings.config.schelf_toml
      ? [settings.config.schelf_toml, settings.config.listing_toml].filter(Boolean).join(", ")
      : "not applied yet",
  )
  blank()
  return EXIT.ok
}

const appAction = (type: "project.delete" | "project.restore") => async (args: Args) => {
  const context = await signedIn(args)
  return approve(context, [{ type, app: args.positionals[0] ?? (await appOf(args)) }], args)
}

async function rename(args: Args) {
  const slug = needs(args.positionals[0], "project rename <address>")
  const context = await signedIn(args)
  return approve(context, [{ type: "project.rename", app: await appOf(args), slug }], args)
}

async function domain(args: Args) {
  const context = await signedIn(args)
  const id = await appOf(args)
  const settings = args.flags.has("check")
    ? await context.dashboard.checkDomain(id)
    : await context.dashboard.app(id)
  const state = settings.app.domain
  emit(state)
  if (!state) {
    note('No custom domain. Set domain = "downloads.example.com" in schelf.toml and run schelf apply.')
    return EXIT.ok
  }
  title(state.domain)
  field("Status", state.waiting ?? state.status)
  if (state.status !== "active")
    for (const record of state.records) field(record.type, `${record.name} ${muted("→")} ${record.value}`)
  blank()
  return EXIT.ok
}

async function stats(args: Args) {
  const context = await signedIn(args)
  const id = await appOf(args)
  const days = Number(args.flags.get("days") ?? 30)
  const result = await context.dashboard.stats(id, days)
  emit(result)
  title(`${id}, last ${days} days`)
  field("Installs", String(result.total.installs))
  field("Updates", String(result.total.updates))
  blank()
  for (const entry of result.versions)
    field(entry.version, `${entry.installs} installs, ${entry.updates} updates`)
  blank()
  for (const entry of result.platforms)
    field(entry.platform, `${entry.installs} installs, ${entry.updates} updates`, 18)
  blank()
  return EXIT.ok
}

export const project = verbs("project", {
  list: {
    usage: "list [--publisher <slug>]",
    about: "Your projects, and deleted ones you can restore",
    run: list,
  },
  show: { usage: "show", about: "Links, feeds, channels and where its settings come from", run: show },
  domain: {
    usage: "domain [--check]",
    about: "The custom domain's DNS records and whether it serves the links yet",
    run: domain,
  },
  stats: { usage: "stats [--days <n>]", about: "Installs and updates by version and system", run: stats },
  rename: {
    usage: "rename <address>",
    about: "Move its page and links (asks you in the browser)",
    run: rename,
  },
  delete: {
    usage: "delete",
    about: "Delete it, restorable for 30 days (asks you in the browser)",
    run: appAction("project.delete"),
  },
  restore: {
    usage: "restore <id>",
    about: "Bring back a deleted project (asks you in the browser)",
    run: appAction("project.restore"),
  },
})
