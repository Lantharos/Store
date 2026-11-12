import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, emit, field, note, title } from "../../ui/output.ts"
import { link } from "../../ui/style.ts"
import { publisherOf, signedIn, verbs } from "../context.ts"

async function status(args: Args) {
  const context = await signedIn(args)
  const owner = publisherOf(context, args)
  const state = await context.dashboard.verification(owner.id)
  emit(state)
  title(`Verification of ${owner.name}`)
  field("Verified", state.verified ? "yes" : "no")
  if (state.current)
    field("Request", `${state.current.status}${state.current.reason ? `: ${state.current.reason}` : ""}`)
  blank()
  note("Asking for verification is a legal declaration with documents, so it's done in the dashboard:")
  note(link(`${context.api}/dashboard/settings/verification`))
  blank()
  return EXIT.ok
}

export const verification = verbs("verification", {
  status: { usage: "status", about: "Whether the publisher is verified, and its request", run: status },
})
