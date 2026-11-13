import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import {
  accessOf,
  extensionLabels,
  joinConfigPath,
  LISTING_TOML,
  type ListingToml,
  listingToml,
  luftVersion,
  type Permissions,
  PUBLISH_ACTION,
  parseConfig,
  readExtensionAccess,
  readPermissions,
  SCHELF_TOML,
  SCHELF_WORKFLOW,
  type SchelfToml,
  sameAppId,
  schelfToml,
} from "@schelf/protocol"
import { ZodError } from "zod"
import type { ConfigPlace } from "../project/config.ts"
import type { Project } from "../project/detect.ts"
import { readOptional } from "../project/files.ts"
import { describePermissions } from "../project/permissions.ts"
import { errorsFrom, type Issue } from "./issues.ts"
import { listingIssues } from "./listing.ts"
import { mediaIssues } from "./media.ts"

export interface ListingFiles {
  file: string
  folder: string
  value: ListingToml
}

export interface Validation {
  manifest?: SchelfToml
  listing?: ListingFiles
  access: string[]
  fullAccess: boolean
  issues: Issue[]
}

const PINNED_SABINE = /release-app\.yml@v?([\d.]+)/

function declaration<T>(file: string, read: () => T, issues: Issue[]): T | undefined {
  try {
    return read()
  } catch (error) {
    issues.push(
      ...(error instanceof ZodError
        ? error.issues.map(
            (issue): Issue => ({
              level: "error",
              file,
              key: issue.path.join(".") || null,
              message: issue.message,
            }),
          )
        : [{ level: "error" as const, file, key: null, message: (error as Error).message }]),
    )
    return undefined
  }
}

async function readListingFiles(
  root: string,
  manifest: SchelfToml,
  issues: Issue[],
): Promise<ListingFiles | undefined> {
  if (!manifest.listing) return undefined
  const folder = joinConfigPath(manifest.listing)
  const file = joinConfigPath(folder, LISTING_TOML)
  const text = await readOptional(join(root, file))
  if (text === undefined) {
    issues.push({
      level: "error",
      file: SCHELF_TOML,
      key: "listing",
      message: `${file} doesn't exist`,
      hint: "schelf init writes one.",
    })
    return undefined
  }
  const read = parseConfig(file, listingToml, text)
  if (!read.ok) {
    issues.push(...errorsFrom(read.issues))
    return undefined
  }
  issues.push(...(await mediaIssues(root, folder, file, read.value)), ...listingIssues(file, read.value))
  return { file, folder, value: read.value }
}

function luftIssues(minimum: unknown): Issue[] {
  if (minimum === undefined)
    return [
      {
        level: "error",
        file: "extension.toml",
        key: "luft.minimum",
        message: "doesn't say the oldest Luft it runs on",
        hint: 'Add [luft] with minimum = "1.0", or a nightly such as minimum = "1.0-nightly.27".',
      },
    ]
  const read = luftVersion.safeParse(minimum)
  return read.success
    ? []
    : [
        {
          level: "error",
          file: "extension.toml",
          key: "luft.minimum",
          message: read.error.issues[0]!.message,
        },
      ]
}

function identityIssues(project: Project, manifest: SchelfToml): Issue[] {
  const issues: Issue[] = []
  const declared = [
    ["Sabine.toml", project.sabine?.id],
    ["extension.toml", project.extension?.id],
    [project.appstream?.path, project.appstream?.component.id.replace(/\.desktop$/, "")],
  ] as const
  for (const [file, id] of declared) {
    if (file && id && manifest.id && !sameAppId(id, manifest.id))
      issues.push({
        level: file.endsWith(".xml") ? "warning" : "error",
        file: SCHELF_TOML,
        key: "id",
        message: `${manifest.id}, but ${file} says ${id}`,
      })
  }
  if (project.sabine && manifest.format !== "sabine")
    issues.push({
      level: "warning",
      file: SCHELF_TOML,
      key: "format",
      message: `${manifest.format}, but there's a Sabine.toml`,
    })
  if (project.extension && manifest.requires.extension_api !== project.extension.api)
    issues.push({
      level: "error",
      file: SCHELF_TOML,
      key: "requires.extension_api",
      message: `${manifest.requires.extension_api}, but extension.toml targets ${project.extension.api}`,
    })
  if (project.extension) issues.push(...luftIssues(project.extension.luft))
  if (manifest.format === "sabine" && project.sabine?.updatesProvider !== "schelf")
    issues.push({
      level: "warning",
      file: "Sabine.toml",
      key: "updates.provider",
      message: "isn't schelf, so copies on Windows and macOS won't get updates",
      hint: 'Set provider = "schelf" under [updates].',
    })
  return issues
}

async function workflowFor(place: ConfigPlace) {
  const file = relative(place.root, place.config).split(sep).join("/")
  const folder = join(place.root, ".github", "workflows")
  const names = (await readdir(folder).catch(() => [])).filter((name) => /\.ya?ml$/.test(name)).sort()
  for (const name of names) {
    const text = await readOptional(join(folder, name))
    if (text?.includes(file)) return { file: `.github/workflows/${name}`, text }
  }
  return { file, text: undefined }
}

async function workflowIssues(place: ConfigPlace, manifest: SchelfToml): Promise<Issue[]> {
  const inMonorepo = place.folder !== place.root
  const found = inMonorepo
    ? await workflowFor(place)
    : { file: SCHELF_WORKFLOW, text: await readOptional(join(place.root, SCHELF_WORKFLOW)) }
  if (!found.text && inMonorepo)
    return [
      {
        level: "warning",
        file: found.file,
        key: null,
        message: "isn't named by any workflow in .github/workflows",
        hint: `Publish it from a workflow with schelf-toml: ${found.file}, or from your own pipeline.`,
      },
    ]
  if (!found.text)
    return [
      {
        level: "error",
        file: SCHELF_WORKFLOW,
        key: null,
        message: "doesn't exist",
        hint: "Run schelf init to write it.",
      },
    ]
  const workflow = found.text
  const workflowFile = found.file
  const issues: Issue[] = []
  if (!workflow.includes(PUBLISH_ACTION.split("@")[0]!))
    issues.push({
      level: "error",
      file: workflowFile,
      key: null,
      message: `doesn't use ${PUBLISH_ACTION}`,
    })
  const pinned = PINNED_SABINE.exec(workflow)?.[1]
  if (
    manifest.format === "sabine" &&
    pinned &&
    manifest.requires.sabine &&
    pinned !== manifest.requires.sabine.replace(/^v/, "")
  )
    issues.push({
      level: "warning",
      file: workflowFile,
      key: null,
      message: `builds with Sabine ${pinned}, schelf.toml requires ${manifest.requires.sabine}`,
    })
  return issues
}

export async function validate(project: Project, place: ConfigPlace): Promise<Validation> {
  const issues: Issue[] = []
  const text = await readOptional(place.config)
  if (text === undefined)
    issues.push({
      level: "error",
      file: SCHELF_TOML,
      key: null,
      message: "doesn't exist",
      hint: "Run schelf init to set the app up.",
    })
  const read = text === undefined ? undefined : parseConfig(SCHELF_TOML, schelfToml, text)
  if (read && !read.ok) issues.push(...errorsFrom(read.issues))
  const manifest = read?.ok ? read.value : undefined

  let permissions: Permissions | null = null
  let access = describePermissions(null)
  let fullAccess = true
  if (manifest?.permissions) {
    const file = manifest.permissions
    const text = await readOptional(join(project.root, file))
    if (text === undefined)
      issues.push({ level: "error", file: SCHELF_TOML, key: "permissions", message: `${file} doesn't exist` })
    else if (manifest.kind === "extension") {
      const extension = declaration(file, () => readExtensionAccess(text), issues)
      access = extension ? extensionLabels(extension) : []
      fullAccess = extension?.helper ?? false
    } else {
      permissions = declaration(file, () => readPermissions(text), issues) ?? null
      access = describePermissions(permissions)
      fullAccess = manifest.format === "sabine" || accessOf(permissions) === "full"
    }
  } else if (manifest?.format === "appimage") {
    issues.push({
      level: "warning",
      file: SCHELF_TOML,
      key: "permissions",
      message: "isn't set, so the store shows the app as needing full access",
      hint: 'Declare what it needs under [sandbox] in permissions.toml and set permissions = "permissions.toml".',
    })
  }

  if (!manifest) return { access, fullAccess, issues }
  issues.push(...identityIssues(project, manifest), ...(await workflowIssues(place, manifest)))
  const listing = await readListingFiles(project.root, manifest, issues)
  if (!manifest.listing && manifest.format !== "files")
    issues.push({
      level: "warning",
      file: SCHELF_TOML,
      key: "listing",
      message: "isn't set, so the store page is whatever the dashboard has",
      hint: 'Set listing = "store" and describe the page in store/listing.toml.',
    })
  return { manifest, listing, access, fullAccess, issues }
}
