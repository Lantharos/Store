import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { readSchelfToml, type SchelfToml } from "@schelf/protocol"

export interface ReleaseContext {
  folder: string
  manifest: SchelfToml
  schelfToml: string
  permissionsToml?: string
  tag?: string
  commit?: string
  notes: string
}

interface GithubEvent {
  release?: { tag_name?: string; body?: string | null }
}

async function githubEvent(): Promise<GithubEvent> {
  const path = process.env.GITHUB_EVENT_PATH
  if (!path) return {}
  return JSON.parse(await readFile(path, "utf8")) as GithubEvent
}

function tagFromRef() {
  const ref = process.env.GITHUB_REF ?? ""
  return ref.startsWith("refs/tags/") ? ref.slice("refs/tags/".length) : undefined
}

export async function releaseContext(schelfTomlPath: string): Promise<ReleaseContext> {
  const folder = dirname(schelfTomlPath)
  const schelfToml = await readFile(schelfTomlPath, "utf8")
  const manifest = readSchelfToml(schelfToml)
  const permissionsToml = manifest.permissions
    ? await readFile(join(folder, manifest.permissions), "utf8")
    : undefined
  const event = await githubEvent()
  return {
    folder,
    manifest,
    schelfToml,
    permissionsToml,
    tag: event.release?.tag_name ?? tagFromRef(),
    commit: process.env.GITHUB_SHA,
    notes: event.release?.body ?? "",
  }
}
