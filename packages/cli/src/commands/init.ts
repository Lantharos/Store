import { stat } from "node:fs/promises"
import { join } from "node:path"
import { SCHELF_WORKFLOW, type SetupInput } from "@schelf/protocol"
import { greet, session } from "../api/auth.ts"
import { dashboard } from "../api/dashboard.ts"
import { type Args, apiOrigin } from "../args.ts"
import { detectProject, type Project } from "../project/detect.ts"
import { readOptional } from "../project/files.ts"
import { repositoryRoot } from "../project/git.ts"
import { plannedFiles, sabineVersion, writePlanned } from "../setup/files.ts"
import { settleIdentity } from "../setup/identity.ts"
import { ensureNamespace } from "../setup/namespace.ts"
import { ensureDeveloper, registerApp } from "../setup/register.ts"
import { blank, done, Failure, field, next, note, step, title } from "../ui/output.ts"
import { confirm } from "../ui/prompt.ts"
import { bold, interactive, muted } from "../ui/style.ts"

const FORMAT_NAMES = { sabine: "a Sabine app", appimage: "an AppImage", "luft-extension": "a Luft extension" }

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

async function setupInput(project: Project, id: string): Promise<SetupInput> {
  return {
    id,
    kind: project.kind,
    format: project.format,
    permissions: await permissionsFile(project),
    listing: (await stat(join(project.root, "store")).catch(() => undefined))?.isDirectory()
      ? "store/"
      : undefined,
    sabineVersion: project.format === "sabine" ? await sabineVersion(project.root) : undefined,
    extensionApi: project.extension?.api,
  }
}

export async function init(args: Args) {
  const api = apiOrigin(args)
  const root = await repositoryRoot(process.cwd())
  title("Set up for Schelf")

  const project = await step("Reading the project", () => detectProject(root), describe)
  if (!project.found.length && !project.appImageEvidence) {
    note(
      "Nothing here builds a Sabine app, an AppImage or a Luft extension, so this sets it up as an AppImage.",
    )
  }
  if (!project.repository) {
    throw new Failure(
      "This repository has no GitHub remote",
      "Schelf publishes from GitHub Actions. Push the project to GitHub, then run schelf init again.",
    )
  }
  const repository = `${project.repository.owner}/${project.repository.name}`
  const identity = await settleIdentity(project)
  blank()
  field("App", bold(identity.name))
  field("Id", identity.id)
  field("Summary", identity.summary)
  field("Repository", repository)
  blank()

  const { token, account: current } = await session(api)
  greet(current)
  const account = dashboard(api, token)
  await ensureDeveloper(api, account, current)
  await ensureNamespace(account, identity.id)
  await registerApp(account, {
    ...identity,
    kind: project.kind,
    format: project.format,
    repository,
    workflow: SCHELF_WORKFLOW,
  })

  const files = await plannedFiles(root, await setupInput(project, identity.id))
  const replaced = files.filter((file) => file.existing !== undefined && file.path !== "Sabine.toml")
  if (replaced.length && interactive) {
    const names = replaced.map((file) => file.path).join(" and ")
    if (!(await confirm(`Replace ${names}?`))) throw new Failure("Left the files as they were")
  }
  await writePlanned(root, files)
  for (const file of files) done(`${file.existing === undefined ? "Wrote" : "Updated"} ${file.path}`)

  next([
    `git add ${files.map((file) => file.path).join(" ")} && git commit -m "Publish on Schelf" && git push`,
    "Publish a GitHub release. It builds, goes through the checks and lands in review.",
    `${bold("schelf status")} shows where it is.`,
  ])
  return 0
}
