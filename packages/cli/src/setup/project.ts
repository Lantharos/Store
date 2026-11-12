import {
  type ApprovalAction,
  appId,
  projectId,
  SCHELF_WORKFLOW,
  slugFromId,
  UPDATER_NAMES,
} from "@schelf/protocol"
import { greet, session } from "../api/auth.ts"
import { dashboard } from "../api/dashboard.ts"
import { type Args, flag } from "../args.ts"
import type { Project } from "../project/detect.ts"
import { sourceOf } from "../project/source.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, done, emit, Failure, field, next } from "../ui/output.ts"
import { bold } from "../ui/style.ts"
import { plannedFiles, writePlanned } from "./files.ts"
import { planNamespace, retryDomainProof } from "./namespace.ts"
import { runPlan } from "./plan.ts"
import { choosePublisher, type Owner, trusts } from "./register.ts"

export async function initProject(api: string, project: Project, args: Args) {
  const repository = project.repository!
  const fullName = `${repository.owner}/${repository.name}`
  const slug = slugFromId(repository.name)
  const name = flag(args, "name") ?? project.name ?? repository.name
  const source = sourceOf(project.licence)
  field("Project", bold(name))
  field("Repository", fullName)
  field("Source", source.licence ? `Open source, ${source.licence}` : "Closed source")
  if (project.framework) field("Updates", UPDATER_NAMES[project.framework.updater])
  blank()

  const { token, account: current } = await session(api)
  greet(current)
  const account = dashboard(api, token)
  const plan: ApprovalAction[] = []
  let owner: Owner = await choosePublisher(
    current,
    { slug: flag(args, "publisher"), name: flag(args, "publisher-name") },
    plan,
  )
  const existing = owner.slug ? (await account.apps(owner.id)).find((app) => app.slug === slug) : undefined
  const wanted = flag(args, "id")
  if (wanted && !appId.safeParse(wanted).success)
    throw new Failure(`${wanted} isn't an app id`, undefined, EXIT.usage)
  if (!existing && wanted) {
    const namespace = await planNamespace(account, owner, wanted, flag(args, "namespace"), plan)
    if (!namespace.proven) {
      owner = await runPlan(api, token, account, owner, plan, args)
      await retryDomainProof(account, owner.id, namespace.prefix)
    }
  }
  if (!existing)
    plan.push({
      type: "project.create",
      publisher: owner.id,
      project: {
        id: wanted,
        name,
        slug,
        ...source,
        repository: fullName,
        updater: project.framework?.updater,
      },
    })
  else if (!trusts(await account.app(existing.id), fullName))
    plan.push({
      type: "trust.add",
      app: existing.id,
      rule: { repository: fullName, workflow: SCHELF_WORKFLOW },
    })
  owner = await runPlan(api, token, account, owner, plan, args)
  const settings = await account.app(existing?.id ?? wanted ?? projectId(owner.slug!, slug))
  done(`${existing ? "Found" : "Created"} ${bold(`${owner.slug}/${slug}`)}, unlisted`)

  const files = await plannedFiles(project.root, {
    id: settings.app.id,
    project: settings.app.id === projectId(owner.slug!, slug) ? `${owner.slug}/${slug}` : undefined,
    kind: "app",
    format: "files",
    updater: project.framework?.updater,
    ...source,
    repository: fullName,
  })
  await writePlanned(project.root, files)
  for (const file of files) done(`${file.existing === undefined ? "Wrote" : "Updated"} ${file.path}`)
  emit({ app: settings.app.id, files: files.map((file) => file.path), links: settings.links })

  blank()
  field("Download page", settings.links.page, 18)
  field("Latest download", settings.links.latest, 18)
  next([
    `git add ${files.map((file) => file.path).join(" ")} && git commit -m "Host releases on Schelf" && git push`,
    "Publish a GitHub release with your build attached. The workflow sends its files to Schelf.",
    `${bold("schelf status")} shows where it is.`,
  ])
  return 0
}
