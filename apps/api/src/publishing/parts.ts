import {
  hasAppPart,
  missingPlatforms,
  offeredIn,
  PartMismatch,
  type PartPlan,
  partLabel,
  partOf,
  TOOL_KINDS,
  toolsOf,
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

type Sorted = { name: string; platform: string; kind: string; part: string | null }

const TOOL_FILE = "a tool is the program itself, or a .tar.gz or .zip holding only the program"

function refuseToolMisfits(app: Pick<AppRow, "tool" | "parts">, files: Sorted[]) {
  for (const entry of toolsOf(app)) {
    const own = files.filter((file) => file.part === entry.part)
    for (const file of own) {
      const fits =
        (TOOL_KINDS as readonly string[]).includes(file.kind) &&
        (file.kind !== "exe" || file.platform.startsWith("windows-"))
      if (!fits) fail(422, `${file.name} is a ${file.kind}, but ${TOOL_FILE}`)
      const same = own.filter((other) => other.platform === file.platform)
      if (same.length > 1)
        fail(
          422,
          `${entry.name} is one file for each system, but ${file.platform} has ${same.map((other) => other.name).join(" and ")}`,
        )
    }
  }
}

export function sortIntoParts<File extends { name: string; platform: string; kind: string }>(
  app: Pick<AppRow, "platforms" | "parts" | "tool">,
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
  refuseToolMisfits(app, sorted)
  const missing = missingPlatforms(plan, sorted)
  if (missing.length)
    fail(
      422,
      `This release has nothing for ${missing.map((each) => (each.part ? `${each.platform} in ${each.part}` : each.platform)).join(", ")}, which schelf.toml asks every release for`,
    )
  return sorted
}
