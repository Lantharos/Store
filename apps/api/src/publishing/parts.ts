import {
  hasAppPart,
  missingPlatforms,
  offeredIn,
  PartMismatch,
  type PartPlan,
  partLabel,
  partOf,
} from "@schelf/protocol"
import { fail } from "../lib/http.ts"
import type { AppRow } from "../signing/records.ts"

export const partPlan = (app: Pick<AppRow, "platforms" | "parts">): PartPlan => ({
  platforms: app.platforms,
  parts: app.parts,
})

function assign(name: string, plan: PartPlan) {
  try {
    return partOf(name, plan)
  } catch (error) {
    if (error instanceof PartMismatch) fail(422, error.message)
    throw error
  }
}

export function sortIntoParts<File extends { name: string; platform: string }>(
  app: Pick<AppRow, "platforms" | "parts">,
  files: File[],
) {
  const plan = partPlan(app)
  const sorted = files.map((file) => ({ ...file, part: assign(file.name, plan) }))
  for (const file of sorted) {
    if (file.part === null && !hasAppPart(plan))
      fail(422, `${file.name} isn't in any part; every file of a project of only parts matches one`)
    if (!offeredIn(plan, file))
      fail(
        422,
        `${file.name} is for ${file.platform}, which ${partLabel(file.part)} isn't built for in schelf.toml`,
      )
  }
  const missing = missingPlatforms(plan, sorted)
  if (missing.length)
    fail(
      422,
      `This release has nothing for ${missing.map((each) => (each.part ? `${each.platform} in ${each.part}` : each.platform)).join(", ")}, which schelf.toml asks every release for`,
    )
  return sorted
}
