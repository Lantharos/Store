import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { type CheckResult, readSchelfToml, SCHELF_TOML } from "@schelf/protocol"
import { session } from "../api/auth.ts"
import { type Dashboard, dashboard } from "../api/dashboard.ts"
import { type Args, apiOrigin, flag } from "../args.ts"
import { repositoryRoot } from "../project/git.ts"
import { blank, Failure, field, line, title } from "../ui/output.ts"
import { bad, good, link, muted, warn } from "../ui/style.ts"

const MARKS = { passed: good("✓"), warning: warn("!"), failed: bad("✕") }

export function printChecks(checks: CheckResult[]) {
  if (!checks.length) return
  blank()
  if (checks.every((check) => check.status === "passed")) {
    line(`${MARKS.passed} All ${checks.length} checks passed`)
    return
  }
  for (const check of checks) line(`${MARKS[check.status]} ${check.name.padEnd(15)}${muted(check.summary)}`)
}

export async function appIdHere(args: Args) {
  const config = flag(args, "config") ?? join(await repositoryRoot(process.cwd()), SCHELF_TOML)
  const text = await readFile(config, "utf8").catch(() => {
    throw new Failure("There's no schelf.toml here", "Run this in the app's repository, or pass --config.")
  })
  return readSchelfToml(text).id
}

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  return `${Math.round(hours / 24)} days ago`
}

export async function findRelease(account: Dashboard, id: string, version: string | undefined) {
  const releases = await account.releases(id)
  const found = version
    ? releases.find((release) => release.version === version.replace(/^v/, ""))
    : releases[0]
  if (found) return found
  throw version
    ? new Failure(`${id} has no release ${version}`)
    : new Failure(`${id} has no releases yet`, "Publish a GitHub release to send the first one.")
}

export async function status(args: Args) {
  const api = apiOrigin(args)
  const id = await appIdHere(args)
  const { token } = await session(api)
  const account = dashboard(api, token)
  const release = await account.release(id, (await findRelease(account, id, args.positionals[0])).id)

  title(`${id} ${release.version}`)
  const origin = release.origin === "oidc" ? "built on GitHub Actions" : "uploaded by the developer"
  line(`${release.status.replace("-", " ")} ${muted(`· ${origin} · ${ago(release.created_at)}`)}`)
  printChecks(release.checks)
  blank()
  if (release.status === "rolling-out" || release.status === "live") {
    field("Rollout", `${release.rollout_percent}%${release.rollout_paused ? ", paused" : ""}`)
  }
  if (release.next) field("Next", release.next)
  if (release.run_url) field("Build", link(release.run_url))
  field("Dashboard", link(`${api}/dashboard/apps/${id}/releases/${release.id}`))
  blank()
  return 0
}
