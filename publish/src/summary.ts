import * as core from "@actions/core"
import type { CompleteResponse, PublishResponse } from "@schelf/protocol"
import type { HashedArtifact } from "@schelf/publisher"

const STATUS_WORDS: Record<string, string> = {
  checking: "is being checked",
  "in-review": "is waiting for review",
  failed: "failed its checks",
}

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`

export async function writeSummary(
  release: PublishResponse,
  completed: CompleteResponse,
  artifacts: HashedArtifact[],
) {
  const status = STATUS_WORDS[completed.status] ?? `is ${completed.status.replace("-", " ")}`
  core.summary.addHeading(`${release.app} ${release.version} ${status}`, 2).addTable([
    [
      { data: "File", header: true },
      { data: "Part", header: true },
      { data: "Platform", header: true },
      { data: "Size", header: true },
    ],
    ...artifacts.map((artifact) => [
      artifact.name,
      artifact.part ?? "The app",
      artifact.platform,
      megabytes(artifact.size),
    ]),
  ])
  if (completed.checks.length && completed.checks.every((check) => check.status === "passed"))
    core.summary.addRaw(`All ${completed.checks.length} checks passed.`).addBreak()
  else if (completed.checks.length)
    core.summary.addTable([
      [
        { data: "Check", header: true },
        { data: "Result", header: true },
        { data: "Details", header: true },
      ],
      ...completed.checks.map((check) => [check.name, check.status, check.summary]),
    ])
  await core.summary
    .addRaw(
      "The malware scan, inspection and source diff follow in a few minutes; the dashboard shows them as they land.",
    )
    .addBreak()
    .addLink("Open the release on Schelf", completed.dashboard)
    .write()
}
