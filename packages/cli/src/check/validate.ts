import { readdir } from "node:fs/promises"
import { join } from "node:path"
import {
  accessOf,
  extensionLabels,
  type Permissions,
  PUBLISH_ACTION,
  readExtensionAccess,
  readPermissions,
  readSchelfToml,
  SCHELF_TOML,
  SCHELF_WORKFLOW,
  type SchelfToml,
  sameAppId,
} from "@schelf/protocol"
import { ZodError } from "zod"
import type { Project } from "../project/detect.ts"
import { readOptional } from "../project/files.ts"
import { describePermissions } from "../project/permissions.ts"
import type { Issue } from "./issues.ts"
import { type Listing, listingIssues, readListing } from "./listing.ts"

export interface Validation {
  manifest?: SchelfToml
  access: string[]
  fullAccess: boolean
  listing: Listing
  issues: Issue[]
}

const SCREENSHOT = /\.(png|jpe?g|webp)$/i
const PINNED_SABINE = /release-app\.yml@v?([\d.]+)/

const zodIssues = (file: string, error: ZodError): Issue[] =>
  error.issues.map((issue) => ({
    level: "error",
    message: `${file}${issue.path.length ? ` ${issue.path.join(".")}` : ""}: ${issue.message}`,
  }))

function parse<T>(file: string, read: () => T, issues: Issue[]): T | undefined {
  try {
    return read()
  } catch (error) {
    issues.push(
      ...(error instanceof ZodError
        ? zodIssues(file, error)
        : [{ level: "error" as const, message: `${file}: ${(error as Error).message}` }]),
    )
    return undefined
  }
}

async function countScreenshots(root: string, listing?: string) {
  if (!listing) return 0
  const entries = await readdir(join(root, listing, "screenshots"), { recursive: true }).catch(() => [])
  return entries.filter((entry) => SCREENSHOT.test(entry)).length
}

function identityIssues(project: Project, manifest: SchelfToml): Issue[] {
  const issues: Issue[] = []
  const declared = [
    ["Sabine.toml", project.sabine?.id],
    ["extension.toml", project.extension?.id],
    [project.appstream?.path, project.appstream?.component.id.replace(/\.desktop$/, "")],
  ] as const
  for (const [file, id] of declared) {
    if (file && id && !sameAppId(id, manifest.id))
      issues.push({
        level: file.endsWith(".xml") ? "warning" : "error",
        message: `${file} says the id is ${id}, schelf.toml says ${manifest.id}`,
      })
  }
  if (project.sabine && manifest.format !== "sabine")
    issues.push({
      level: "warning",
      message: `There's a Sabine.toml, but schelf.toml says the format is ${manifest.format}`,
    })
  if (project.extension && manifest.requires.extension_api !== project.extension.api)
    issues.push({
      level: "error",
      message: `extension.toml targets extension API ${project.extension.api}, schelf.toml requires ${manifest.requires.extension_api}`,
    })
  if (manifest.format === "sabine" && project.sabine?.updatesProvider !== "schelf")
    issues.push({
      level: "warning",
      message: "Sabine.toml doesn't update from Schelf, so copies on Windows and macOS won't get updates",
      hint: 'Set provider = "schelf" under [updates].',
    })
  return issues
}

async function workflowIssues(project: Project, manifest: SchelfToml): Promise<Issue[]> {
  const workflow = await readOptional(join(project.root, SCHELF_WORKFLOW))
  if (!workflow)
    return [
      { level: "error", message: `There's no ${SCHELF_WORKFLOW}`, hint: "Run schelf init to write it." },
    ]
  const issues: Issue[] = []
  if (!workflow.includes(PUBLISH_ACTION.split("@")[0]!))
    issues.push({ level: "error", message: `${SCHELF_WORKFLOW} doesn't use ${PUBLISH_ACTION}` })
  const pinned = PINNED_SABINE.exec(workflow)?.[1]
  if (
    manifest.format === "sabine" &&
    pinned &&
    manifest.requires.sabine &&
    pinned !== manifest.requires.sabine.replace(/^v/, "")
  )
    issues.push({
      level: "warning",
      message: `The workflow builds with Sabine ${pinned}, schelf.toml requires ${manifest.requires.sabine}`,
    })
  return issues
}

export async function validate(project: Project): Promise<Validation> {
  const issues: Issue[] = []
  const text = await readOptional(join(project.root, SCHELF_TOML))
  if (text === undefined) {
    issues.push({
      level: "error",
      message: "There's no schelf.toml",
      hint: "Run schelf init to set the app up.",
    })
  }
  const manifest = text === undefined ? undefined : parse(SCHELF_TOML, () => readSchelfToml(text), issues)

  let permissions: Permissions | null = null
  let access = describePermissions(null)
  let fullAccess = true
  if (manifest?.permissions) {
    const file = manifest.permissions
    const declaration = await readOptional(join(project.root, file))
    if (declaration === undefined) issues.push({ level: "error", message: `${file} doesn't exist` })
    else if (manifest.kind === "extension") {
      const extension = parse(file, () => readExtensionAccess(declaration), issues)
      access = extension ? extensionLabels(extension) : []
      fullAccess = extension?.helper ?? false
    } else {
      permissions = parse(file, () => readPermissions(declaration), issues) ?? null
      access = describePermissions(permissions)
      fullAccess = manifest.format === "sabine" || accessOf(permissions) === "full"
    }
  } else if (manifest?.format === "appimage") {
    issues.push({
      level: "warning",
      message: "No permission declaration, so the store shows the app as needing full access",
      hint: 'Declare what it needs under [sandbox] in permissions.toml and set permissions = "permissions.toml".',
    })
  }

  if (manifest)
    issues.push(...identityIssues(project, manifest), ...(await workflowIssues(project, manifest)))
  const listing = readListing(project, await countScreenshots(project.root, manifest?.listing))
  issues.push(...listingIssues(listing))
  return { manifest, access, fullAccess, listing, issues }
}
