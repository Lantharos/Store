import { attestProvenance } from "@actions/attest"
import * as core from "@actions/core"
import { downloadReleaseAssets, releaseTag } from "./assets.ts"
import { type Outcome, type Plan, program, schelf } from "./schelf.ts"
import { writeSummary } from "./summary.ts"

const lines = (name: string) => core.getMultilineInput(name).filter(Boolean)

async function attest(plan: Plan, token: string) {
  try {
    await attestProvenance({
      subjects: plan.artifacts.map((artifact) => ({
        name: artifact.name,
        digest: { sha256: artifact.sha256 },
      })),
      token,
    })
  } catch (error) {
    throw new Error(
      `Recording build provenance failed: ${(error as Error).message}. The job needs permissions: attestations: write and id-token: write.`,
    )
  }
}

async function patterns(githubToken: string) {
  const files = lines("files")
  const assets = lines("release-assets")
  if (!files.length && !assets.length) throw new Error("Give the action files or release-assets to publish")
  if (!assets.length) return files
  const tag = await releaseTag()
  if (!tag) throw new Error("release-assets publishes a GitHub release's files; run this on a release")
  return [...files, ...(await downloadReleaseAssets(tag, assets, githubToken))]
}

function options() {
  const given = (flag: string, input: string) => {
    const value = core.getInput(input)
    return value ? [`--${flag}`, value] : []
  }
  return [
    "--config",
    core.getInput("schelf-toml"),
    ...given("api", "api"),
    ...given("channel", "channel"),
    ...given("notes", "notes"),
    ...(core.getBooleanInput("bridge") ? ["--bridge"] : []),
  ]
}

async function run() {
  const githubToken = core.getInput("github-token")
  const files = await patterns(githubToken)
  const path = await core.group("Getting schelf", program)
  const asked = [...options(), ...(core.getInput("version") ? ["--version", core.getInput("version")] : [])]
  const { answer: plan } = await schelf<Plan>(path, ["publish", "--dry-run", ...asked, "--", ...files])

  await core.group("Recording build provenance", () => attest(plan, githubToken))
  const { answer: outcome, code } = await core.group(`Publishing ${plan.app} ${plan.version}`, () =>
    schelf<Outcome>(path, ["publish", ...options(), "--version", plan.version, "--", ...files]),
  )

  core.setOutput("release", outcome.release)
  core.setOutput("status", outcome.status)
  core.setOutput("url", outcome.url)
  await writeSummary(plan, outcome)
  for (const check of outcome.checks.filter((check) => check.status !== "passed")) {
    const report = check.status === "failed" ? core.error : core.warning
    report(check.summary, { title: `Schelf: ${check.name}` })
  }
  if (code !== 0 || outcome.status === "failed")
    core.setFailed(`${plan.app} ${plan.version} failed its checks`)
  else
    core.notice(
      `${plan.app} ${plan.version}${plan.channel ? ` on ${plan.channel}` : ""} is ${outcome.status.replace("-", " ")}: ${outcome.url}`,
    )
}

run().catch((error: unknown) => core.setFailed((error as Error).message))
