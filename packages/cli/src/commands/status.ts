import type { CheckResult, ReleaseDetail, ReleaseSummary } from "@schelf/protocol"
import type { Args } from "../args.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, emit, field, line, note, title } from "../ui/output.ts"
import { bad, good, link, muted, warn } from "../ui/style.ts"
import { appOf, type Context, findRelease, signedIn } from "./context.ts"

const MARKS = { passed: good("✓"), warning: warn("!"), failed: bad("✕") }
const IN_FLIGHT = new Set<ReleaseSummary["status"]>([
  "uploading",
  "checking",
  "in-review",
  "changes-requested",
  "rolling-out",
])
const WAITING_ON_YOU = new Set<ReleaseSummary["status"]>(["failed", "changes-requested", "uploading"])

export function printChecks(checks: CheckResult[]) {
  if (!checks.length) return
  if (checks.every((check) => check.status === "passed")) {
    line(`${MARKS.passed} All ${checks.length} checks passed`)
    return
  }
  for (const check of checks) line(`${MARKS[check.status]} ${check.name.padEnd(15)}${muted(check.summary)}`)
}

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  return `${Math.round(hours / 24)} days ago`
}

const where = (release: ReleaseSummary) =>
  release.status === "rolling-out" || release.status === "live"
    ? `${release.status.replace("-", " ")}, ${release.rollout_percent}%${release.rollout_paused ? ", paused" : ""}`
    : release.status.replace("-", " ")

function printRelease(context: Context, id: string, release: ReleaseDetail) {
  title(`${id} ${release.version} on ${release.channel}`)
  const origin = release.origin === "oidc" ? "built on GitHub Actions" : "uploaded by the developer"
  line(`${where(release)} ${muted(`· ${origin} · ${ago(release.created_at)}`)}`)
  blank()
  printChecks(release.checks)
  blank()
  if (release.next) field("Next", release.next)
  if (release.run_url) field("Build", link(release.run_url))
  field("Dashboard", link(`${context.api}/dashboard/apps/${id}/releases/${release.id}`))
  blank()
}

async function overview(context: Context, id: string) {
  const [settings, releases, approvals] = await Promise.all([
    context.dashboard.app(id),
    context.dashboard.releases(id),
    context.dashboard.approvals(),
  ])
  const flying = releases.filter((release) => IN_FLIGHT.has(release.status))
  const latestPerChannel = [...new Map(releases.map((release) => [release.channel, release])).values()]
  const attention = latestPerChannel.filter((release) => WAITING_ON_YOU.has(release.status))
  const details = await Promise.all(
    [...flying, ...attention.filter((release) => !flying.includes(release))].map((release) =>
      context.dashboard.release(id, release.id),
    ),
  )
  const waiting = approvals
  const app = settings.app
  emit({ app: settings.app, releases: details, approvals: waiting, config: settings.config })

  title(`${app.name} ${muted(app.id)}`)
  field(
    "Visibility",
    app.visibility === "listed"
      ? "listed"
      : app.listing_requested
        ? "unlisted, waiting for a reviewer to list it"
        : "unlisted",
  )
  field(
    "Files",
    settings.config.applied_at
      ? `applied ${ago(settings.config.applied_at)}`
      : "never applied; run schelf apply",
  )
  blank()
  if (!details.length) note(releases.length ? "Nothing in flight." : "No releases yet.")
  for (const release of details) {
    line(`${release.version} ${muted(`on ${release.channel}`)}  ${where(release)}`)
    for (const check of release.checks.filter((entry) => entry.status !== "passed"))
      line(`  ${MARKS[check.status]} ${check.name}: ${muted(check.summary)}`)
    if (release.next) note(`  ${release.next}`)
  }
  if (waiting.length) {
    blank()
    line("Waiting for your approval:")
    for (const approval of waiting)
      line(`  ${approval.steps.map((step) => step.summary).join("; ")} ${muted(approval.url)}`)
  }
  blank()
  return waiting.length || attention.length ? EXIT.waiting : EXIT.ok
}

export async function status(args: Args) {
  const context = await signedIn(args)
  const id = await appOf(args)
  const [version] = args.positionals
  if (!version) return overview(context, id)
  const release = await context.dashboard.release(id, (await findRelease(context.dashboard, id, version)).id)
  emit(release)
  printRelease(context, id, release)
  return EXIT.ok
}
