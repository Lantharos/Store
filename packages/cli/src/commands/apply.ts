import { hostname } from "node:os"
import type { ApplyResponse } from "@schelf/protocol"
import { applyConfig, configBundle } from "@schelf/publisher"
import { presentApproval } from "../api/approvals.ts"
import { credential } from "../api/identity.ts"
import { type Args, apiOrigin } from "../args.ts"
import { configPlace } from "../project/config.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, caution, done, emit, field, line, note, step, title } from "../ui/output.ts"
import { muted } from "../ui/style.ts"

export function printApplied(result: ApplyResponse) {
  const width = Math.max(14, ...result.changes.map((change) => `${change.file} ${change.key}`.length + 2))
  for (const change of result.changes) field(`${change.file} ${change.key}`, muted(change.change), width)
  if (result.changes.length) blank()
  for (const text of result.review) line(`Waiting for review: ${text}`)
  for (const text of result.notes) caution(text)
}

export async function apply(args: Args) {
  const api = apiOrigin(args)
  const { root, config } = await configPlace(args)
  const bundle = await configBundle(root, config)
  const dryRun = args.flags.has("dry-run")
  const { token } = await credential(args)
  title(dryRun ? "What applying would change" : "Applying the files")
  const result = await step(
    dryRun ? "Comparing with the store" : "Applying",
    () => applyConfig(api, token, bundle, { dryRun, host: hostname() }),
    (applied) =>
      applied.changes.length
        ? `${applied.changes.length} change${applied.changes.length === 1 ? "" : "s"}`
        : "Nothing to change",
  )
  emit(result)
  printApplied(result)
  if (!dryRun && result.applied) done(`${result.app} matches its files`)
  if (dryRun) note("Nothing was changed.")
  blank()
  if (!result.request) return EXIT.ok
  line("Asking to be listed needs you to approve it.")
  return (await presentApproval(api, token, result.request, args)).code
}
