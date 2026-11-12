import { ROLES, type Role } from "@schelf/protocol"
import { type Args, flag } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, emit, Failure, field, title } from "../../ui/output.ts"
import { muted } from "../../ui/style.ts"
import { approve, type Context, needs, publisherOf, signedIn, verbs } from "../context.ts"

function roleOf(value: string | undefined): Role {
  if (value && (ROLES as readonly string[]).includes(value)) return value as Role
  throw new Failure(`${value ?? "No role"} isn't a role`, `Use ${ROLES.join(", ")}.`, EXIT.usage)
}

async function memberId(context: Context, publisherId: string, who: string) {
  const { members } = await context.dashboard.members(publisherId)
  const found = members.find((member) => member.user_id === who || member.email === who.toLowerCase())
  if (!found) throw new Failure(`${who} isn't a member`, "schelf member list shows who is.", EXIT.usage)
  return found.user_id
}

async function list(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const result = await context.dashboard.members(owner.id)
  emit(result)
  title(`Members of ${owner.name}`)
  for (const member of result.members) field(member.email, `${member.name} ${muted(member.role)}`, 32)
  for (const invite of result.invites)
    field(
      invite.email ?? `@${invite.github}`,
      muted(`invited as ${invite.role}, until ${invite.expires_at.slice(0, 10)} · ${invite.id}`),
      32,
    )
  blank()
  return EXIT.ok
}

async function invite(args: Args) {
  const who = needs(args.positionals[0], "member invite <email|@github> --role <role>")
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const to = who.includes("@") && !who.startsWith("@") ? { email: who } : { github: who }
  return approve(
    context,
    [{ type: "member.invite", publisher: owner.id, to, role: roleOf(flag(args, "role") ?? "developer") }],
    args,
  )
}

const onMember =
  (type: "member.remove" | "member.transfer" | "member.role", usage: string) => async (args: Args) => {
    const who = needs(args.positionals[0], usage)
    const context = await signedIn(args)
    const owner = publisherOf(context, args)
    const user = await memberId(context, owner.id, who)
    if (type === "member.role")
      return approve(
        context,
        [{ type, publisher: owner.id, user, role: roleOf(needs(args.positionals[1], usage)) }],
        args,
      )
    return approve(context, [{ type, publisher: owner.id, user }], args)
  }

async function leave(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  return approve(context, [{ type: "member.remove", publisher: owner.id, user: context.me.user.id }], args)
}

export const member = verbs("member", {
  list: { usage: "list", about: "Members and open invitations", run: list },
  invite: {
    usage: "invite <email|@github> [--role <role>]",
    about: "Invite someone (asks you in the browser)",
    run: invite,
  },
  role: {
    usage: "role <email> <owner|admin|developer>",
    about: "Change a member's role (asks you, with a passkey)",
    run: onMember("member.role", "member role <email> <role>"),
  },
  remove: {
    usage: "remove <email>",
    about: "Remove a member (asks you in the browser)",
    run: onMember("member.remove", "member remove <email>"),
  },
  transfer: {
    usage: "transfer <email>",
    about: "Hand over ownership (asks you, with a passkey)",
    run: onMember("member.transfer", "member transfer <email>"),
  },
  leave: { usage: "leave", about: "Leave the organisation (asks you in the browser)", run: leave },
})
