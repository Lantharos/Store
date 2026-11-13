import { resolve } from "node:path"
import { attestProvenance } from "@actions/attest"
import * as core from "@actions/core"
import { describeIssue, manifestName } from "@schelf/protocol"
import {
  ApiFailure,
  ConfigError,
  collectArtifacts,
  configBundle,
  githubOidcToken,
  hashArtifacts,
  publishRelease,
  releaseContext,
  releaseVersion,
} from "@schelf/publisher"
import { downloadReleaseAssets } from "./assets.ts"
import { writeSummary } from "./summary.ts"

const lines = (name: string) => core.getMultilineInput(name).filter(Boolean)

async function attest(artifacts: { name: string; sha256: string }[], token: string) {
  try {
    await attestProvenance({
      subjects: artifacts.map((artifact) => ({ name: artifact.name, digest: { sha256: artifact.sha256 } })),
      token,
    })
  } catch (error) {
    throw new Error(
      `Recording build provenance failed: ${(error as Error).message}. The job needs permissions: attestations: write and id-token: write.`,
    )
  }
}

async function run() {
  const api = core.getInput("api").replace(/\/$/, "")
  const githubToken = core.getInput("github-token")
  const schelfToml = resolve(core.getInput("schelf-toml"))
  const context = await releaseContext(schelfToml)
  const config = await configBundle(process.env.GITHUB_WORKSPACE ?? process.cwd(), schelfToml)
  const channel = core.getInput("channel") || undefined
  const version = await releaseVersion({
    version: core.getInput("version") || undefined,
    folder: context.folder,
    format: context.manifest.format,
    tag: context.tag,
    commit: context.commit,
    channel,
  })

  const patterns = lines("files")
  const assetPatterns = lines("release-assets")
  if (!patterns.length && !assetPatterns.length)
    throw new Error("Give the action files or release-assets to publish")
  if (assetPatterns.length) {
    if (!context.tag)
      throw new Error("release-assets publishes a GitHub release's files; run this on a release")
    patterns.push(...(await downloadReleaseAssets(context.tag, assetPatterns, githubToken)))
  }

  const artifacts = await hashArtifacts(await collectArtifacts(patterns, context.manifest))
  for (const artifact of artifacts)
    core.info(`${[artifact.part, artifact.platform].filter(Boolean).join(" ").padEnd(24)} ${artifact.name}`)

  await core.group("Recording build provenance", () => attest(artifacts, githubToken))
  const token = await githubOidcToken()
  const { applied, release, completed } = await core.group(
    `Publishing ${manifestName(context.manifest)} ${version}`,
    () =>
      publishRelease(
        {
          api,
          token,
          version,
          channel,
          bridge: core.getBooleanInput("bridge"),
          commit: context.commit,
          schelfToml: context.schelfToml,
          permissionsToml: context.permissionsToml,
          config,
          notes: core.getInput("notes") || context.notes,
          artifacts,
        },
        (event) => {
          if (event.type === "uploaded") core.info(`Uploaded ${event.name} (${event.done}/${event.total})`)
        },
      ),
  )

  for (const change of applied.changes) core.info(`${change.file} ${change.key}: ${change.change}`)
  for (const text of [...applied.review, ...applied.notes]) core.notice(text)
  core.setOutput("release", release.release)
  core.setOutput("status", completed.status)
  core.setOutput("url", completed.dashboard)
  await writeSummary(release, completed, artifacts)
  for (const check of completed.checks.filter((check) => check.status !== "passed")) {
    const report = check.status === "failed" ? core.error : core.warning
    report(check.summary, { title: `Schelf: ${check.name}` })
  }
  if (completed.status === "failed") core.setFailed(`${release.app} ${release.version} failed its checks`)
  else
    core.notice(
      `${release.app} ${release.version} on ${release.channel} is ${completed.status.replace("-", " ")}: ${completed.dashboard}`,
    )
}

function failure(error: unknown) {
  if (error instanceof ConfigError) return error.issues.map(describeIssue).join("\n")
  if (error instanceof ApiFailure) return `Schelf refused the release: ${error.detail}`
  return (error as Error).message
}

run().catch((error: unknown) => core.setFailed(failure(error)))
