import type { RolloutRequest } from "@schelf/protocol"
import type { Args } from "../args.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, done, emit, Failure, step } from "../ui/output.ts"
import { appOf, findRelease, needs, signedIn } from "./context.ts"

const USAGE = "rollout <version> <percent|pause|resume|all>"

export function rolloutRequest(change: string): RolloutRequest {
  if (change === "pause" || change === "resume" || change === "all") return { action: change }
  const percent = Number(change.replace(/%$/, ""))
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new Failure(
      `${change} isn't a rollout change`,
      "Use a percentage from 1 to 100, pause, resume or all.",
      EXIT.usage,
    )
  }
  return percent === 100 ? { action: "all" } : { action: "set", percent }
}

export async function rollout(args: Args) {
  const [version, change] = args.positionals
  const request = rolloutRequest(needs(change, USAGE))
  const context = await signedIn(args)
  const id = await appOf(args)
  blank()
  const release = await step(`Changing the rollout of ${id} ${needs(version, USAGE)}`, async () =>
    context.dashboard.rollout(id, (await findRelease(context.dashboard, id, version)).id, request),
  )
  emit(release)
  done(`${release.rollout_percent}% of devices${release.rollout_paused ? ", paused" : ""}`)
  blank()
  return EXIT.ok
}
