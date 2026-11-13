import { spawn } from "node:child_process"
import { join } from "node:path"
import { STORE, schelfProgram, thisComputer } from "@schelf/program"
import { type CheckResult, type ConfigIssue, describeIssue, type ProjectTool } from "@schelf/protocol"

export interface PlannedFile {
  name: string
  path: string
  part: string | null
  platform: string
  kind: string
  size: number
  sha256: string
}

export interface Plan {
  app: string
  version: string
  channel: string | null
  artifacts: PlannedFile[]
}

export interface Outcome {
  release: string
  status: string
  checks: CheckResult[]
  tools: ProjectTool[]
  url: string
}

interface Refusal {
  error: string
  hint?: string | null
  issues?: ConfigIssue[]
}

export async function program() {
  const target = thisComputer()
  if (!target) throw new Error("Publish on Schelf runs on Linux runners, such as ubuntu-latest")
  const cache = process.env.RUNNER_TOOL_CACHE ?? process.env.RUNNER_TEMP ?? "."
  return schelfProgram({ store: STORE, folder: join(cache, "schelf"), target })
}

function refusal(answer: Refusal) {
  return [answer.error, answer.hint, ...(answer.issues ?? []).map(describeIssue)].filter(Boolean).join("\n")
}

/** Runs schelf with `args` and `--json`, its progress going to the log, and reads what it answers. */
export function schelf<T>(path: string, args: string[]): Promise<{ answer: T; code: number }> {
  return new Promise((resolve, reject) => {
    const [command, ...rest] = args
    const child = spawn(path, [command!, "--json", ...rest], { stdio: ["ignore", "pipe", "inherit"] })
    const chunks: Buffer[] = []
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk))
    child.on("error", reject)
    child.on("close", (code) => {
      const text = Buffer.concat(chunks).toString("utf8").trim()
      const answer = text ? (JSON.parse(text) as T | Refusal) : null
      if (answer && typeof answer === "object" && "error" in answer) reject(new Error(refusal(answer)))
      else if (answer === null) reject(new Error(`schelf ${command} stopped without an answer (${code})`))
      else resolve({ answer, code: code ?? 1 })
    })
  })
}
