import { askApproval } from "../../api/approvals.ts"
import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, done, emit, field, line, note, title } from "../../ui/output.ts"
import { bold, muted } from "../../ui/style.ts"
import { appOf, approve, needs, signedIn, verbs } from "../context.ts"

async function list(args: Args) {
  const context = await signedIn(args)
  const settings = await context.dashboard.app(await appOf(args))
  emit(settings.channels)
  title(`Channels of ${settings.app.id}`)
  for (const channel of settings.channels)
    field(
      channel.name,
      [
        `${channel.releases} release${channel.releases === 1 ? "" : "s"}`,
        channel.gradual ? "step by step" : "everyone at once",
        channel.keep ? `keeps ${channel.keep}` : "keeps every release",
        channel.ended_into && `ended into ${channel.ended_into}`,
        channel.invite_only && "invite-only",
      ]
        .filter(Boolean)
        .join(", "),
    )
  blank()
  note("Change them under [channels] in schelf.toml, then run schelf apply.")
  blank()
  return EXIT.ok
}

async function people(args: Args) {
  const name = needs(args.positionals[0], "channel people <channel>")
  const context = await signedIn(args)
  const access = await context.dashboard.channelAccess(await appOf(args), name)
  emit(access)
  title(`Who gets ${name}`)
  if (!access.invites.length && !access.tokens.length)
    note("Nobody yet. Invite people with schelf channel invite.")
  for (const invite of access.invites)
    field(invite.id, `${invite.email} ${muted(`invited by ${invite.invited_by}`)}`, 20)
  for (const token of access.tokens.filter((each) => !each.revoked_at))
    field(
      token.id,
      `${token.name} ${muted(`download token${token.last_used_at ? `, last used ${token.last_used_at.slice(0, 10)}` : ""}`)}`,
      20,
    )
  blank()
  return EXIT.ok
}

async function invite(args: Args) {
  const name = needs(args.positionals[0], "channel invite <channel> <email>")
  const email = needs(args.positionals[1], "channel invite <channel> <email>")
  const context = await signedIn(args)
  return approve(context, [{ type: "channel.invite", app: await appOf(args), channel: name, email }], args)
}

async function uninvite(args: Args) {
  const name = needs(args.positionals[0], "channel uninvite <channel> <id>")
  const id = needs(args.positionals[1], "channel uninvite <channel> <id>")
  const context = await signedIn(args)
  emit(await context.dashboard.uninvite(await appOf(args), name, id))
  done(`They can't download from ${name} any more`)
  return EXIT.ok
}

async function token(args: Args) {
  const name = needs(args.positionals[0], "channel token <channel> <name>")
  const label = needs(args.positionals[1], "channel token <channel> <name>")
  const context = await signedIn(args)
  const { code, approval } = await askApproval(
    context.api,
    context.token,
    [{ type: "channel.token", app: await appOf(args), channel: name, name: label }],
    args,
  )
  const secret = approval.secrets[label]
  if (!secret) return code
  blank()
  line(bold(secret))
  note("Shown once. Send it as Authorization: Bearer <token> to the channel's links and feeds.")
  blank()
  return code
}

async function revoke(args: Args) {
  const name = needs(args.positionals[0], "channel revoke <channel> <id>")
  const id = needs(args.positionals[1], "channel revoke <channel> <id>")
  const context = await signedIn(args)
  emit(await context.dashboard.revokeChannelToken(await appOf(args), name, id))
  done(`Revoked ${id}`)
  return EXIT.ok
}

export const channel = verbs("channel", {
  list: { usage: "list", about: "Channels, how they roll out and how many releases they keep", run: list },
  people: { usage: "people <channel>", about: "Who can download from an invite-only channel", run: people },
  invite: {
    usage: "invite <channel> <email>",
    about: "Let someone download from an invite-only channel (asks you in the browser)",
    run: invite,
  },
  uninvite: { usage: "uninvite <channel> <id>", about: "Take an invitation back, at once", run: uninvite },
  token: {
    usage: "token <channel> <name>",
    about: "Make a download token for machines, shown once (asks you in the browser)",
    run: token,
  },
  revoke: { usage: "revoke <channel> <id>", about: "Stop a download token working, at once", run: revoke },
})
