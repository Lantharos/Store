import type { RolloutRequest } from "@schelf/protocol"
import { session } from "../api/auth.ts"
import { dashboard } from "../api/dashboard.ts"
import { type Args, apiOrigin } from "../args.ts"
import { blank, done, Failure, step } from "../ui/output.ts"
import { appIdHere } from "./status.ts"

export function rolloutRequest(change: string): RolloutRequest {
  if (change === "pause" || change === "resume" || change === "all") return { action: change }
  const percent = Number(change.replace(/%$/, ""))
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new Failure(
      `${change} isn't a rollout change`,
      "Use a percentage from 1 to 100, pause, resume or all.",
    )
  }
  return percent === 100 ? { action: "all" } : { action: "set", percent }
}

export async function rollout(args: Args) {
  const [version, change] = args.positionals
  if (!version || !change) throw new Failure("Usage: schelf rollout <version> <percent|pause|resume|all>")
  const request = rolloutRequest(change)
  const api = apiOrigin(args)
  const id = await appIdHere(args)
  const { token } = await session(api)
  blank()
  const release = await step(`Changing the rollout of ${id} ${version}`, () =>
    dashboard(api, token).rollout(id, version, request),
  )
  done(`${release.rollout_percent}% of devices${release.rollout_paused ? ", paused" : ""}`)
  blank()
  return 0
}
