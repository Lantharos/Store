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
import { findFiles, readOptional } from "../project/files.ts"
import { followSchelfUpdates } from "../project/sabine.ts"

const RELEASE_APP = /Lantharos\/Sabine\/\.github\/workflows\/release-app\.yml@(v[\d.]+)?/i
const CARGO_PIN = /Lantharos\/Sabine(?:\.git)?"[^}\n]*\btag\s*=\s*"(v[\d.]+)"/i
const PACKAGE_PIN = /Lantharos\/Sabine#(v[\d.]+)/i
const CARRIED_INPUTS = /^\s+(rust_toolchain|upgrade_from_sabine_version|linux_packages|platforms):\s*(.+)$/gm

const newest = (...versions: string[]) =>
  versions.reduce((left, right) => (compareVersions(left, right) >= 0 ? left : right))

async function sabineWorkflows(root: string) {
  const folder = join(root, ".github", "workflows")
  const names = await readdir(folder).catch(() => [])
  const files = await Promise.all(
    names.map(async (name) => ({
      path: `.github/workflows/${name}`,
      text: (await readOptional(join(folder, name))) ?? "",
    })),
  )
  return files.filter((file) => RELEASE_APP.test(file.text))
}

async function pinnedVersions(root: string) {
  const manifests = await findFiles(root, (name) => name === "Cargo.toml")
  const texts = await Promise.all(manifests.map((path) => readOptional(join(root, path))))
  return [
    ...(await sabineWorkflows(root)).map((workflow) => RELEASE_APP.exec(workflow.text)?.[1]),
    ...texts.map((text) => CARGO_PIN.exec(text ?? "")?.[1]),
    PACKAGE_PIN.exec((await readOptional(join(root, "package.json"))) ?? "")?.[1],
  ].filter((version) => version !== undefined)
}

interface SabineRelease {
  tag_name: string
  draft: boolean
  prerelease: boolean
}

export async function sabineVersion(root: string) {
  const pinned = await pinnedVersions(root)
  if (pinned.length) return newest(...pinned, SCHELF_SABINE_VERSION)
  const releases = await request<SabineRelease[]>(
    `https://api.github.com/repos/${SABINE_REPOSITORY}/releases?per_page=100`,
    {},
  )
  const published = releases.filter((release) => !release.draft && !release.prerelease)
  return newest(...published.map((release) => release.tag_name), SCHELF_SABINE_VERSION)
}

export async function sabineInputs(root: string) {
  const workflows = await sabineWorkflows(root)
  const inputs = workflows.flatMap((workflow) => [...workflow.text.matchAll(CARRIED_INPUTS)])
  return inputs.length ? Object.fromEntries(inputs.map(([, name, value]) => [name!, value!])) : undefined
}

export async function replacedWorkflows(root: string) {
  const workflows = await sabineWorkflows(root)
  return workflows.map((workflow) => workflow.path).filter((path) => path !== SCHELF_WORKFLOW)
}

export interface PlannedFile {
  path: string
  contents: string | Uint8Array
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
