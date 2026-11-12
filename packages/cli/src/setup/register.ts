import {
  type Account,
  type ApprovalAction,
  type AppSettings,
  type DashboardPublisher,
  NEW_PUBLISHER,
  ROLE_NAMES,
  SCHELF_WORKFLOW,
} from "@schelf/protocol"
import { ApiFailure } from "@schelf/publisher"
import type { Dashboard } from "../api/dashboard.ts"
import { EXIT } from "../ui/exit.ts"
import { Failure } from "../ui/output.ts"
import { ask, choose } from "../ui/prompt.ts"
import { interactive } from "../ui/style.ts"

export type Owner = { id: string; name: string; slug: string | null }

export async function registeredApp(account: Dashboard, id: string) {
  return account.app(id).catch((error: unknown) => {
    if (error instanceof ApiFailure && error.status === 404) return undefined
    throw error
  })
}

export async function choosePublisher(
  current: Account,
  wanted: { slug?: string; name?: string },
  plan: ApprovalAction[],
): Promise<Owner> {
  const publishers = current.publishers
  if (wanted.slug) {
    const match = publishers.find(
      (publisher) => publisher.slug === wanted.slug || publisher.id === wanted.slug,
    )
    if (!match)
      throw new Failure(
        `You aren't a member of ${wanted.slug}`,
        "schelf whoami lists your publishers.",
        EXIT.usage,
      )
    return match
  }
  if (!publishers.length) {
    const name =
      wanted.name ??
      (interactive ? await ask("Your name as a publisher", current.user.name) : current.user.name)
    plan.push({ type: "publisher.create", kind: "person", name })
    return { id: NEW_PUBLISHER, name, slug: null }
  }
  if (publishers.length === 1) return publishers[0]!
  if (!interactive)
    throw new Failure(
      "This account publishes as more than one publisher",
      "Pass --publisher <slug> to pick one.",
      EXIT.usage,
    )
  return choose<DashboardPublisher>(
    "Publish as",
    publishers.map((publisher) => ({
      label: publisher.name,
      value: publisher,
      detail: publisher.kind === "person" ? "You" : ROLE_NAMES[publisher.role].label,
    })),
  )
}

export function trusts(existing: AppSettings, repository: string) {
  return existing.trusted_publishers.some(
    (rule) => rule.repository.toLowerCase() === repository.toLowerCase() && rule.workflow === SCHELF_WORKFLOW,
  )
}
