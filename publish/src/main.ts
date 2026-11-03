import { attestProvenance } from "@actions/attest"
import * as core from "@actions/core"
import {
  ApiFailure,
  collectArtifacts,
  githubOidcToken,
  hashArtifacts,
  publishRelease,
  releaseContext,
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
  const context = await releaseContext(core.getInput("schelf-toml"))
  if (!context.tag)
    throw new Error("This run isn't for a tag. Run it on a published release or a pushed tag.")

  const patterns = lines("files")
  const assetPatterns = lines("release-assets")
  if (!patterns.length && !assetPatterns.length)
    throw new Error("Give the action files or release-assets to publish")
  if (assetPatterns.length)
    patterns.push(...(await downloadReleaseAssets(context.tag, assetPatterns, githubToken)))

  const artifacts = await hashArtifacts(await collectArtifacts(patterns, context.manifest.format))
  for (const artifact of artifacts) core.info(`${artifact.platform.padEnd(16)} ${artifact.name}`)

  await core.group("Recording build provenance", () => attest(artifacts, githubToken))
  const token = await githubOidcToken()
  const { release, completed } = await core.group(`Publishing ${context.manifest.id} ${context.tag}`, () =>
    publishRelease(
      {
        api,
        token,
        tag: context.tag!,
        commit: context.commit,
        schelfToml: context.schelfToml,
        permissionsToml: context.permissionsToml,
        notes: core.getInput("notes") || context.notes,
        artifacts,
      },
      (event) => {
        if (event.type === "uploaded") core.info(`Uploaded ${event.name} (${event.done}/${event.total})`)
      },
    ),
  )

  core.setOutput("release", release.release)
  core.setOutput("status", completed.status)
  core.setOutput("url", completed.dashboard)
  await writeSummary(release, completed, artifacts)
  for (const check of completed.checks.filter((check) => check.status !== "passed")) {
    const report = check.status === "failed" ? core.error : core.warning
    report(check.summary, { title: `Schelf: ${check.name}` })
  }
  if (completed.status === "failed") core.setFailed(`${release.app} ${release.version} failed its checks`)
  else core.notice(`${release.app} ${release.version} is on its way to review: ${completed.dashboard}`)
}

run().catch((error: unknown) => {
  core.setFailed(
    error instanceof ApiFailure ? `Schelf refused the release: ${error.detail}` : (error as Error).message,
  )
})
