import { type Account, AGREEMENT_VERSION, type CreateApp, SCHELF_WORKFLOW } from "@schelf/protocol"
import { ApiFailure } from "@schelf/publisher"
import type { Dashboard } from "../api/dashboard.ts"
import { blank, done, Failure, note, step } from "../ui/output.ts"
import { ask, choose, confirm } from "../ui/prompt.ts"
import { bold, interactive } from "../ui/style.ts"

export async function ensureDeveloper(api: string, account: Dashboard, current: Account) {
  if (current.developer) return
  if (!interactive)
    throw new Failure("This account isn't a developer yet", "Run schelf init in a terminal once.")
  blank()
  note(
    "First time here. Schelf needs a name to show on your apps, and your agreement to the developer terms.",
  )
  const name = await ask("Developer name", current.user.name)
  const kind = await choose("Publishing as", [
    { label: "A person", value: "person" as const },
    { label: "An organisation", value: "organisation" as const },
  ])
  note(`${api}/legal/developer-agreement`)
  if (!(await confirm("Accept the developer agreement?"))) throw new Failure("The agreement wasn't accepted")
  await step("Creating your developer account", () =>
    account.becomeDeveloper({ name, kind, agreement: AGREEMENT_VERSION }),
  )
}

export async function registerApp(account: Dashboard, app: CreateApp) {
  const existing = await account.app(app.id).catch((error: unknown) => {
    if (error instanceof ApiFailure && error.status === 404) return undefined
    throw error
  })
  if (!existing) {
    await step(`Registering ${bold(app.id)} with ${app.repository} as its publisher`, () =>
      account.createApp(app),
    )
    return true
  }
  const trusted = existing.publishers.some(
    (publisher) =>
      publisher.repository.toLowerCase() === app.repository.toLowerCase() &&
      publisher.workflow === SCHELF_WORKFLOW,
  )
  if (trusted) {
    done(`${app.repository} already publishes ${bold(app.id)}`)
    return false
  }
  await step(`Trusting ${app.repository} to publish ${bold(app.id)}`, () =>
    account.addPublisher(app.id, { repository: app.repository, workflow: SCHELF_WORKFLOW }),
  )
  return false
}
