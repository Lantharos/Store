import { ROLE_NAMES } from "@schelf/protocol"
import { session } from "../api/auth.ts"
import { type Args, apiOrigin } from "../args.ts"
import { blank, field, line, note, title } from "../ui/output.ts"
import { accent, bold, muted } from "../ui/style.ts"

export async function whoami(args: Args) {
  const { account } = await session(apiOrigin(args))
  title(account.user.name)
  field("Email", account.user.email)
  field("GitHub", account.github ?? muted("not connected"))
  blank()
  if (!account.publishers.length) {
    note("No publishers yet. schelf init sets one up.")
    blank()
    return 0
  }
  line(bold("Publishes as"))
  for (const publisher of account.publishers) {
    const role = publisher.kind === "person" ? "you" : ROLE_NAMES[publisher.role].label.toLowerCase()
    const verified = publisher.verified ? ` ${accent("✓ verified")}` : ""
    field(publisher.slug, `${publisher.name}${verified}  ${muted(role)}`, 24)
  }
  if (account.invites.length) {
    blank()
    note(
      `${account.invites.length} invitation${account.invites.length === 1 ? "" : "s"} waiting in the dashboard`,
    )
  }
  blank()
  return 0
}
