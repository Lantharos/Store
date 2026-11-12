import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, emit, field, note, title } from "../../ui/output.ts"
import { appOf, signedIn, verbs } from "../context.ts"

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
      ]
        .filter(Boolean)
        .join(", "),
    )
  blank()
  note("Change them under [channels] in schelf.toml, then run schelf apply.")
  blank()
  return EXIT.ok
}

export const channel = verbs("channel", {
  list: { usage: "list", about: "Channels, how they roll out and how many releases they keep", run: list },
})
