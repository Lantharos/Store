import type { Args } from "../../args.ts"
import { EXIT } from "../../ui/exit.ts"
import { blank, done, emit, field, note, title } from "../../ui/output.ts"
import { muted } from "../../ui/style.ts"
import { appOf, approve, findRelease, needs, signedIn, verbs } from "../context.ts"
import { status } from "../status.ts"

async function list(args: Args) {
  const context = await signedIn(args)
  const id = await appOf(args)
  const releases = await context.dashboard.releases(id)
  emit(releases)
  title(`Releases of ${id}`)
  if (!releases.length) note("None yet.")
  for (const release of releases)
    field(
      release.version,
      `${release.channel.padEnd(10)}${release.status.replace("-", " ")}${release.rollout_percent < 100 && release.status === "rolling-out" ? ` ${release.rollout_percent}%` : ""} ${muted(release.created_at.slice(0, 10))}`,
      24,
    )
  blank()
  return EXIT.ok
}

async function promote(args: Args) {
  const [version, channel] = args.positionals
  const target = needs(channel, "release promote <version> <channel>")
  const context = await signedIn(args)
  const id = await appOf(args)
  const release = await findRelease(
    context.dashboard,
    id,
    needs(version, "release promote <version> <channel>"),
  )
  const promoted = await context.dashboard.promote(id, release.id, target)
  emit(promoted)
  done(`${id} ${release.version} is on ${target} too`)
  return EXIT.ok
}

const releaseAction =
  (type: "release.rollback" | "release.inside-luft", usage: string) => async (args: Args) => {
    const context = await signedIn(args)
    const id = await appOf(args)
    const release = await findRelease(context.dashboard, id, needs(args.positionals[0], usage))
    return approve(context, [{ type, app: id, release: release.id }], args)
  }

export const release = verbs("release", {
  list: { usage: "list", about: "Every release, newest first", run: list },
  show: { usage: "show [version]", about: "One release: checks, review, rollout", run: status },
  promote: {
    usage: "promote <version> <channel>",
    about: "Put a shipped release on another channel",
    run: promote,
  },
  rollback: {
    usage: "rollback <version>",
    about: "Stop it for everyone and offer the one before (asks you in the browser)",
    run: releaseAction("release.rollback", "release rollback <version>"),
  },
  "inside-luft": {
    usage: "inside-luft <version>",
    about: "Ask for an extension release to run inside Luft (asks you in the browser)",
    run: releaseAction("release.inside-luft", "release inside-luft <version>"),
  },
})
