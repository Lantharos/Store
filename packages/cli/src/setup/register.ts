import {
  type Account,
  AGREEMENT_VERSION,
  type AppSettings,
  type CreateApp,
  type DashboardPublisher,
  ROLE_NAMES,
  SCHELF_WORKFLOW,
} from "@schelf/protocol"
import { ApiFailure } from "@schelf/publisher"
import type { Dashboard } from "../api/dashboard.ts"
import { blank, done, Failure, note, step } from "../ui/output.ts"
import { ask, choose, confirm } from "../ui/prompt.ts"
import { bold, interactive } from "../ui/style.ts"

export async function registeredApp(account: Dashboard, id: string) {
  return account.app(id).catch((error: unknown) => {
    if (error instanceof ApiFailure && error.status === 404) return undefined
    throw error
  })
}

async function createPersonal(api: string, account: Dashboard, current: Account) {
  if (!interactive)
    throw new Failure("This account doesn't publish anything yet", "Run schelf init in a terminal once.")
  blank()
  note(
    "First time here. Schelf needs the name to show on your apps, and your agreement to the developer terms.",
  )
  const name = await ask("Your name as a publisher", current.user.name)
  note(`${api}/legal/developer-agreement`)
  if (!(await confirm("Accept the developer agreement?"))) throw new Failure("The agreement wasn't accepted")
  return step(`Creating ${bold(name)}`, () =>
    account.createPublisher({ kind: "person", name, agreement: AGREEMENT_VERSION }),
  )
}

export async function choosePublisher(
  api: string,
  account: Dashboard,
  current: Account,
  wanted: string | undefined,
): Promise<DashboardPublisher> {
  const publishers = current.publishers
  if (wanted) {
    const match = publishers.find((publisher) => publisher.slug === wanted || publisher.id === wanted)
    if (!match) throw new Failure(`You aren't a member of ${wanted}`, "schelf whoami lists your publishers.")
    return match
  }
  if (!publishers.length) return createPersonal(api, account, current)
  if (publishers.length === 1) return publishers[0]!
  if (!interactive)
    throw new Failure(
      "This account publishes as more than one publisher",
      "Pass --publisher <slug> to pick one.",
    )
  return choose(
    "Publish as",
    publishers.map((publisher) => ({
      label: publisher.name,
      value: publisher,
      detail: publisher.kind === "person" ? "You" : ROLE_NAMES[publisher.role].label,
    })),
  )
}

export async function registerApp(
  account: Dashboard,
  publisher: DashboardPublisher,
  existing: AppSettings | undefined,
  app: CreateApp,
) {
  if (!existing) {
    await step(
      `Registering ${bold(app.id)} for ${publisher.name} with ${app.repository} as its publisher`,
      () => account.createApp(publisher.id, app),
    )
    return true
  }
  const trusted = existing.trusted_publishers.some(
    (rule) =>
      rule.repository.toLowerCase() === app.repository.toLowerCase() && rule.workflow === SCHELF_WORKFLOW,
  )
  if (trusted) {
    done(`${app.repository} already publishes ${bold(app.id)}`)
    return false
  }
  await step(`Trusting ${app.repository} to publish ${bold(app.id)}`, () =>
    account.addTrustedPublisher(app.id, { repository: app.repository, workflow: SCHELF_WORKFLOW }),
  )
  return false
}
