import { mkdir, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  compareVersions,
  SABINE_REPOSITORY,
  SCHELF_SABINE_VERSION,
  SCHELF_WORKFLOW,
  type SetupInput,
  schelfTomlFor,
  workflowFor,
} from "@schelf/protocol"
import { request } from "@schelf/publisher"
import { readOptional } from "../project/files.ts"
import { followSchelfUpdates } from "../project/sabine.ts"

const RELEASE_APP = /Lantharos\/Sabine\/\.github\/workflows\/release-app\.yml@(v[\d.]+)/i

const newest = (...versions: string[]) =>
  versions.reduce((left, right) => (compareVersions(left, right) >= 0 ? left : right))

export async function sabineVersion(root: string) {
  const workflows = join(root, ".github", "workflows")
  for (const name of await readdir(workflows).catch(() => [])) {
    const pinned = RELEASE_APP.exec((await readOptional(join(workflows, name))) ?? "")?.[1]
    if (pinned) return newest(pinned, SCHELF_SABINE_VERSION)
  }
  const latest = await request<{ tag_name: string }>(
    `https://api.github.com/repos/${SABINE_REPOSITORY}/releases/latest`,
    {},
  )
  return newest(latest.tag_name, SCHELF_SABINE_VERSION)
}

export interface PlannedFile {
  path: string
  contents: string
  existing?: string
}

export async function plannedFiles(root: string, input: SetupInput): Promise<PlannedFile[]> {
  const plan = async (path: string, contents: string) => ({
    path,
    contents,
    existing: await readOptional(join(root, path)),
  })
  const files = [
    await plan("schelf.toml", schelfTomlFor(input)),
    await plan(SCHELF_WORKFLOW, workflowFor(input)),
  ]
  if (input.format === "sabine") {
    const sabine = (await readOptional(join(root, "Sabine.toml")))!
    files.push({ path: "Sabine.toml", contents: followSchelfUpdates(sabine), existing: sabine })
  }
  return files.filter((file) => file.contents !== file.existing)
}

export async function writePlanned(root: string, files: PlannedFile[]) {
  for (const file of files) {
    const path = join(root, file.path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.contents)
  }
}
