import { appId, SUMMARY_LIMIT } from "@schelf/protocol"
import type { Project } from "../project/detect.ts"
import { EXIT } from "../ui/exit.ts"
import { Failure } from "../ui/output.ts"
import { ask } from "../ui/prompt.ts"
import { interactive } from "../ui/style.ts"

export interface Identity {
  id: string
  name: string
  summary: string
}

async function settle(
  current: string | undefined,
  question: string,
  suggestion: string | undefined,
  missing: string,
  option: string,
) {
  if (current) return current
  if (!interactive)
    throw new Failure(
      missing,
      `Pass --${option}, or add it to your AppStream file or Sabine.toml.`,
      EXIT.usage,
    )
  const answer = await ask(question, suggestion)
  if (!answer) throw new Failure(missing)
  return answer
}

export interface Given {
  id?: string
  name?: string
  summary?: string
}

export async function settleIdentity(project: Project, given: Given): Promise<Identity> {
  const repository = project.repository!
  const suggestedId = `io.github.${repository.owner}.${repository.name.replace(/[^A-Za-z0-9_-]/g, "_")}`
  const id = await settle(given.id ?? project.id, "App id", suggestedId, "The app has no id", "id")
  const parsed = appId.safeParse(id)
  if (!parsed.success) throw new Failure(parsed.error.issues[0]!.message)
  const name = await settle(
    given.name ?? project.name,
    "Name people will see",
    repository.name,
    "The app has no name",
    "name",
  )
  const summary = await settle(
    given.summary ?? project.summary,
    "One line that says what it does",
    undefined,
    "The app has no summary",
    "summary",
  )
  if (summary.length > SUMMARY_LIMIT) {
    throw new Failure(`The summary is ${summary.length} characters`, `Keep it to ${SUMMARY_LIMIT} or fewer.`)
  }
  return { id, name, summary }
}
