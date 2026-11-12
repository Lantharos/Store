import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, done, emit, field, note, title } from "../../ui/output.ts"
import { muted } from "../../ui/style.ts"
import { approve, needs, publisherOf, signedIn, verbs } from "../context.ts"

async function list(args: Args) {
  const context = await signedIn(args)
  emit(context.me.invites)
  title("Invitations for you")
  if (!context.me.invites.length) note("None.")
  for (const invite of context.me.invites)
    field(
      invite.id,
      `${invite.publisher.name} ${muted(`as ${invite.role}, until ${invite.expires_at.slice(0, 10)}`)}`,
      20,
    )
  blank()
  return EXIT.ok
}

async function accept(args: Args) {
  const invite = needs(args.positionals[0], "invite accept <id>")
  return approve(await signedIn(args), [{ type: "invite.accept", invite }], args)
}

async function decline(args: Args) {
  const invite = needs(args.positionals[0], "invite decline <id>")
  await (await signedIn(args)).dashboard.declineInvite(invite)
  emit({ declined: invite })
  done("Declined")
  return EXIT.ok
}

async function revoke(args: Args) {
  const invite = needs(args.positionals[0], "invite revoke <id>")
  const context = await signedIn(args)
  await context.dashboard.revokeInvite(publisherOf(context, args).id, invite)
  emit({ revoked: invite })
  done("Withdrew the invitation")
  return EXIT.ok
}

export const invite = verbs("invite", {
  list: { usage: "list", about: "Invitations waiting for you", run: list },
  accept: { usage: "accept <id>", about: "Join (asks you in the browser)", run: accept },
  decline: { usage: "decline <id>", about: "Turn one down", run: decline },
  revoke: { usage: "revoke <id>", about: "Withdraw one you sent", run: revoke },
})
