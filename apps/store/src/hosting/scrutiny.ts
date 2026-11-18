import {
  CHECK_TITLES,
  type CheckName,
  type CheckResult,
  NIGHTLY,
  type Origin,
  type Visibility,
} from "@schelf/protocol"

const INFORMATIONAL = new Set<CheckName>(["listing", "licence", "diff"])
const REQUIRED: CheckName[] = ["malware", "inspection"]

export interface RouteInput {
  origin: Origin
  visibility: Visibility
  channel: string
  checks: Pick<CheckResult, "name" | "status">[]
}

export type Route = { route: "automatic" } | { route: "review"; because: string }

export function reviewEveryRelease({ origin, visibility, channel }: Omit<RouteInput, "checks">) {
  if (origin === "manual") return "Uploaded by the developer"
  if (visibility === "listed" && channel !== NIGHTLY) return "Listed projects are reviewed on every release"
  return null
}

export function reviewRoute(input: RouteInput): Route {
  const always = reviewEveryRelease(input)
  if (always) return { route: "review", because: always }
  const missing = REQUIRED.filter((name) => !input.checks.some((check) => check.name === name))
  if (missing.length)
    return {
      route: "review",
      because: `${missing.map((name) => CHECK_TITLES[name]).join(" and ")} didn't run`,
    }
  const flagged = input.checks.filter((check) => check.status !== "passed" && !INFORMATIONAL.has(check.name))
  if (flagged.length)
    return {
      route: "review",
      because: `${flagged.map((check) => CHECK_TITLES[check.name]).join(", ")} needs a look`,
    }
  return { route: "automatic" }
}
