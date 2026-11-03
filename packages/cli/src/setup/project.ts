import { SCHELF_WORKFLOW, slugFromId, UPDATER_NAMES } from "@schelf/protocol"
import { greet, session } from "../api/auth.ts"
import { dashboard } from "../api/dashboard.ts"
import type { Project } from "../project/detect.ts"
import { sourceOf } from "../project/source.ts"
import { blank, done, field, next } from "../ui/output.ts"
import { bold } from "../ui/style.ts"
import { plannedFiles, writePlanned } from "./files.ts"
import { choosePublisher } from "./register.ts"

export async function initProject(api: string, project: Project, wantedPublisher: string | undefined) {
  const repository = project.repository!
  const slug = slugFromId(repository.name)
  const name = project.name ?? repository.name
  const source = sourceOf(project.licence)
  field("Project", bold(name))
  field("Repository", `${repository.owner}/${repository.name}`)
  field("Source", source.licence ? `Open source, ${source.licence}` : "Closed source")
  if (project.framework) field("Updates", UPDATER_NAMES[project.framework.updater])
  blank()

  const { token, account: current } = await session(api)
  greet(current)
  const account = dashboard(api, token)
  const publisher = await choosePublisher(api, account, current, wantedPublisher)
  const existing = (await account.apps(publisher.id)).find((app) => app.slug === slug)
  const settings = existing
    ? await account.app(existing.id)
    : await account.createProject(publisher.id, {
        name,
        slug,
        ...source,
        repository: `${repository.owner}/${repository.name}`,
        updater: project.framework?.updater,
      })
  done(`${existing ? "Found" : "Created"} ${bold(`${publisher.slug}/${slug}`)}, unlisted`)
  if (!settings.trusted_publishers.some((rule) => rule.workflow === SCHELF_WORKFLOW)) {
    await account.addTrustedPublisher(settings.app.id, {
      repository: `${repository.owner}/${repository.name}`,
      workflow: SCHELF_WORKFLOW,
    })
    done(`Trusted ${SCHELF_WORKFLOW} to publish`)
  }
  if (existing && project.framework && settings.app.updater !== project.framework.updater)
    await account.switchUpdater(settings.app.id, project.framework.updater)

  const files = await plannedFiles(project.root, {
    id: settings.app.id,
    project: `${publisher.slug}/${slug}`,
    kind: "app",
    format: "files",
  })
  await writePlanned(project.root, files)
  for (const file of files) done(`${file.existing === undefined ? "Wrote" : "Updated"} ${file.path}`)

  blank()
  field("Download page", settings.links.page)
  field("Latest download", settings.links.latest)
  next([
    `git add ${files.map((file) => file.path).join(" ")} && git commit -m "Host releases on Schelf" && git push`,
    "Publish a GitHub release with your build attached. The workflow sends its files to Schelf.",
    `${bold("schelf status")} shows where it is.`,
  ])
  return 0
}
