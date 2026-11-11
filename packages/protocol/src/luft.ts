import { parse } from "smol-toml"
import { z } from "zod"

const LUFT_VERSION = /^(\d+)\.(\d+)(?:-nightly\.(\d+))?$/

const MISSING_MINIMUM =
  'extension.toml needs the oldest Luft it runs on: add [luft] with minimum = "1.0", or a nightly such as minimum = "1.0-nightly.27"'

/** A version of Luft, such as 1.2 or 1.2-nightly.21, which comes before 1.2. */
export const luftVersion = z
  .string({ error: MISSING_MINIMUM })
  .regex(LUFT_VERSION, "A Luft version looks like 1.2 or 1.2-nightly.21")

const manifestLuft = z.object({ luft: z.object({ minimum: luftVersion }, { error: MISSING_MINIMUM }) })

export function readLuftMinimum(manifest: string) {
  return manifestLuft.parse(parse(manifest)).luft.minimum
}

export function luftVersionLabel(version: string) {
  const [, major, release, nightly] = LUFT_VERSION.exec(version)!
  return nightly ? `Luft ${major}.${release} nightly ${nightly}` : `Luft ${major}.${release}`
}
