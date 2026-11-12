import { rm } from "node:fs/promises"
import { join } from "node:path"
import { type ApprovalAction, SCHELF_WORKFLOW, type SetupInput } from "@schelf/protocol"
import { greet, session } from "../api/auth.ts"
import { dashboard } from "../api/dashboard.ts"
import { type Args, apiOrigin, flag } from "../args.ts"
import { detectProject, type Project } from "../project/detect.ts"
import { readOptional } from "../project/files.ts"
import { defaultBranch, repositoryRoot } from "../project/git.ts"
import { sourceOf } from "../project/source.ts"
import { plannedFiles, replacedWorkflows, sabineInputs, sabineVersion, writePlanned } from "../setup/files.ts"
import { helperBuild } from "../setup/helper.ts"
import { settleIdentity } from "../setup/identity.ts"
import { LISTING_FOLDER, listingFiles } from "../setup/listing.ts"
import { planNamespace, retryDomainProof } from "../setup/namespace.ts"
import { runPlan } from "../setup/plan.ts"
import { initProject } from "../setup/project.ts"
import { choosePublisher, type Owner, registeredApp, trusts } from "../setup/register.ts"
import { EXIT } from "../ui/exit.ts"
import { blank, caution, done, emit, Failure, field, next, note, step, title } from "../ui/output.ts"
import { confirm } from "../ui/prompt.ts"
import { bold, interactive, muted } from "../ui/style.ts"

const FORMAT_NAMES = {
  sabine: "a Sabine app",
  appimage: "an AppImage",
  "luft-extension": "a Luft extension",
  files: "a project",
}

function describe(project: Project) {
  const what = FORMAT_NAMES[project.format]
  return project.found.length
    ? `Found ${what} ${muted(`in ${project.found.join(", ")}`)}`
    : "Read the project"
}

async function permissionsFile(project: Project) {
  if (project.format === "sabine") return project.sabine?.sandbox ? "Sabine.toml" : undefined
  if (project.format === "appimage")
    return (await readOptional(join(project.root, "permissions.toml"))) ? "permissions.toml" : undefined
  return undefined
}

const VERSION_FILES = { sabine: "Sabine.toml", "luft-extension": "extension.toml" } as const

async function publishBranch(project: Project, args: Args) {
  if (!(project.format === "sabine" || project.format === "luft-extension")) return undefined
  const branch = await defaultBranch(project.root)
  if (args.flags.has("publish-on-version-change")) return branch
  if (!interactive) return undefined
  const question = `Also publish whenever the version in ${VERSION_FILES[project.format]} changes on ${branch}?`
  return (await confirm(question, false)) ? branch : undefined
}

async function setupInput(project: Project, id: string, args: Args): Promise<SetupInput> {
  const repository = project.repository!
  return {
    id,
    kind: project.kind,
    format: project.format,
    permissions: await permissionsFile(project),
    listing: LISTING_FOLDER,
    ...sourceOf(project.licence),
    repository: `${repository.owner}/${repository.name}`,
    sabineVersion: project.format === "sabine" ? await sabineVersion(project.root) : undefined,
    sabineInputs: project.format === "sabine" ? await sabineInputs(project.root) : undefined,
    extensionApi: project.extension?.api,
    helper: project.extension?.helper
      ? { path: project.extension.helper, build: await helperBuild(project.root, project.extension.helper) }
      : undefined,
    branch: await publishBranch(project, args),
  }
}

async function retireReleaseWorkflows(root: string, args: Args) {
  for (const path of await replacedWorkflows(root)) {
    const remove =
      args.flags.has("remove-old-workflows") ||
      (interactive && (await confirm(`Remove ${path}? It won't publish anything from now on`)))
    if (remove) {
      await rm(join(root, path))
      done(`Removed ${path}`)
    } else {
      caution(`${path} won't publish anything from now on; remove it when you're ready`)
    }
  }
}

export async function init(args: Args) {
  const api = apiOrigin(args)
  const root = await repositoryRoot(process.cwd())
  title("Set up for Schelf")

  const project = await step("Reading the project", () => detectProject(root), describe)
  if (!project.repository) {
    throw new Failure(
      "This repository has no GitHub remote",
      "Schelf publishes from GitHub Actions. Push the project to GitHub, then run schelf init again.",
    )
  }
  if (project.format === "files") {
    if (!project.framework)
      note(
        "Nothing here builds a Sabine app or a Luft extension, so Schelf hosts its release files as they are.",
      )
    return initProject(api, project, args)
  }
  const repository = `${project.repository.owner}/${project.repository.name}`
  const identity = await settleIdentity(project, {
    id: flag(args, "id"),
    name: flag(args, "name"),
    summary: flag(args, "summary"),
  })
  blank()
  field("App", bold(identity.name))
  field("Id", identity.id)
  field("Summary", identity.summary)
  field("Repository", repository)
  blank()

  const { token, account: current } = await session(api)
  greet(current)
  const account = dashboard(api, token)
  const existing = await registeredApp(account, identity.id)
  const plan: ApprovalAction[] = []
  let owner: Owner =
    current.publishers.find((candidate) => candidate.id === existing?.app.publisher) ??
    (await choosePublisher(
      current,
      { slug: flag(args, "publisher"), name: flag(args, "publisher-name") },
      plan,
    ))
  done(`Publishing as ${bold(owner.name)}`)
  const namespace = await planNamespace(account, owner, identity.id, flag(args, "namespace"), plan)
  if (!namespace.proven) {
    owner = await runPlan(api, token, account, owner, plan, args)
    await retryDomainProof(account, owner.id, namespace.prefix)
  }
  if (!existing)
    plan.push({
      type: "app.create",
      publisher: owner.id,
      app: {
        id: identity.id,
        name: identity.name,
        summary: identity.summary,
        kind: project.kind,
        format: project.format,
        ...sourceOf(project.licence),
        repository,
        workflow: SCHELF_WORKFLOW,
      },
    })
  else if (!trusts(existing, repository))
    plan.push({ type: "trust.add", app: identity.id, rule: { repository, workflow: SCHELF_WORKFLOW } })
  else done(`${repository} already publishes ${bold(identity.id)}`)
  await runPlan(api, token, account, owner, plan, args)

  const files = [
    ...(await plannedFiles(root, await setupInput(project, identity.id, args))),
    ...(await listingFiles(project, identity)),
  ]
  const replaced = files.filter((file) => file.existing !== undefined && file.path !== "Sabine.toml")
  if (replaced.length && !args.flags.has("replace")) {
    const names = replaced.map((file) => file.path).join(" and ")
    if (!interactive)
      throw new Failure(`${names} already exist`, "Pass --replace to write them again.", EXIT.usage)
    if (!(await confirm(`Replace ${names}?`))) throw new Failure("Left the files as they were")
  }
  await writePlanned(root, files)
  for (const file of files) done(`${file.existing === undefined ? "Wrote" : "Updated"} ${file.path}`)
  if (project.format === "sabine") await retireReleaseWorkflows(root, args)
  if (project.sabine?.updatesProvider === "github")
    note(`Copies already installed need one more GitHub release: ${api}/docs/moving-from-github-releases`)
  emit({ app: identity.id, files: files.map((file) => file.path) })

  next([
    `${bold("schelf check")} shows the store page and anything missing, and ${bold("schelf apply")} sends the listing.`,
    `git add ${[...new Set(files.map((file) => (file.path.startsWith(`${LISTING_FOLDER}/`) ? LISTING_FOLDER : file.path)))].join(" ")} && git commit -m "Publish on Schelf" && git push`,
    project.format === "appimage"
      ? "Publish a GitHub release with the AppImages. They go through the checks and land in review."
      : "Run the Publish to Schelf workflow (gh workflow run schelf.yml). It builds, goes through the checks and lands in review.",
    `${bold("schelf status")} shows where it is. To be in the store, set listed = true in store/listing.toml and run schelf apply.`,
  ])
  return 0
}
