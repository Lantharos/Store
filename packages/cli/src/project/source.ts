import type { CreateProject } from "@schelf/protocol"

const OPEN_SOURCE =
  /^(MIT|ISC|Apache-2\.0|BSD-[23]-Clause|MPL-2\.0|[AL]?GPL-[23]\.0(-only|-or-later)?|Unlicense|0BSD|Zlib)$/

export function sourceOf(licence: string | undefined): Pick<CreateProject, "distribution" | "licence"> {
  return licence && OPEN_SOURCE.test(licence)
    ? { distribution: "open", licence }
    : { distribution: "proprietary" }
}
