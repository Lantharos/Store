import * as core from "@actions/core"
import type { Outcome, Plan } from "./schelf.ts"

const STATUS_WORDS: Record<string, string> = {
  checking: "is being checked",
  "in-review": "is waiting for review",
  failed: "failed its checks",
}

const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`

export async function writeSummary(plan: Plan, outcome: Outcome) {
  const status = STATUS_WORDS[outcome.status] ?? `is ${outcome.status.replace("-", " ")}`
  core.summary.addHeading(`${plan.app} ${plan.version} ${status}`, 2).addTable([
    [
      { data: "File", header: true },
      { data: "Part", header: true },
      { data: "Platform", header: true },
      { data: "Size", header: true },
    ],
    ...plan.artifacts.map((artifact) => [
      artifact.name,
      artifact.part ?? "The app",
      artifact.platform,
      megabytes(artifact.size),
    ]),
  ])
  if (outcome.checks.length && outcome.checks.every((check) => check.status === "passed"))
    core.summary.addRaw(`All ${outcome.checks.length} checks passed.`).addBreak()
  else if (outcome.checks.length)
    core.summary.addTable([
      [
        { data: "Check", header: true },
        { data: "Result", header: true },
        { data: "Details", header: true },
      ],
      ...outcome.checks.map((check) => [check.name, check.status, check.summary]),
    ])
  if (outcome.tools.length)
    core.summary
      .addHeading("Installing it", 3)
      .addCodeBlock(outcome.tools.flatMap((tool) => [tool.install, tool.add]).join("\n"), "sh")
  await core.summary
    .addRaw(
      "The malware scan, inspection and source diff follow in a few minutes; the dashboard shows them as they land.",
    )
    .addBreak()
    .addLink("Open the release on Schelf", outcome.url)
    .write()
}
