import { readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import {
  API_BASE,
  type ApplyRequest,
  type ApplyResponse,
  type ConfigIssue,
  folderOf,
  joinConfigPath,
  LISTING_TOML,
  listingToml,
  parseConfig,
  SCHELF_TOML,
  schelfToml,
  screenshotFile,
} from "@schelf/protocol"
import { digest, mapLimit } from "./files.ts"
import { request } from "./http.ts"

export class ConfigError extends Error {
  constructor(readonly issues: ConfigIssue[]) {
    super(
      `${issues.length} thing${issues.length === 1 ? "" : "s"} in the files need${issues.length === 1 ? "s" : ""} fixing`,
    )
  }
}

export interface ConfigBundle {
  request: ApplyRequest
  files: Map<string, string>
}

const UPLOAD_CONCURRENCY = 4

async function readOrIssue(path: string, file: string, key: string | null, issues: ConfigIssue[]) {
  try {
    return await readFile(path, "utf8")
  } catch {
    issues.push({ file, key, message: "doesn't exist" })
    return undefined
  }
}

export async function configBundle(
  root: string,
  schelfTomlPath = join(root, SCHELF_TOML),
): Promise<ConfigBundle> {
  const issues: ConfigIssue[] = []
  const schelfPath = relative(root, schelfTomlPath).split(sep).join("/")
  const text = await readOrIssue(schelfTomlPath, schelfPath, null, issues)
  if (text === undefined) throw new ConfigError(issues)
  const manifest = parseConfig(schelfPath, schelfToml, text)
  if (!manifest.ok) throw new ConfigError(manifest.issues)
  const bundle: ConfigBundle = {
    request: { schelf_toml: text, schelf_toml_path: schelfPath, media: [] },
    files: new Map(),
  }
  if (!manifest.value.listing) return bundle
  const folder = joinConfigPath(folderOf(schelfPath), manifest.value.listing)
  const listingPath = joinConfigPath(folder, LISTING_TOML)
  const listingText = await readOrIssue(join(root, listingPath), listingPath, null, issues)
  if (listingText === undefined) throw new ConfigError(issues)
  bundle.request.listing_toml = listingText
  const listing = parseConfig(listingPath, listingToml, listingText)
  if (!listing.ok) throw new ConfigError(listing.issues)
  const entries = [
    ...(listing.value.icon ? [{ file: listing.value.icon, key: "icon" }] : []),
    ...(listing.value.screenshots ?? []).map((entry, index) => ({
      file: screenshotFile(entry).file,
      key: `screenshots.${index}`,
    })),
  ]
  const media = await mapLimit(entries, UPLOAD_CONCURRENCY, async ({ file, key }) => {
    const path = joinConfigPath(folder, file)
    try {
      const { sha256, size } = await digest(join(root, path))
      bundle.files.set(sha256, join(root, path))
      return { path, sha256, size }
    } catch {
      issues.push({ file: listingPath, key, message: `${file} doesn't exist in ${folder}` })
      return undefined
    }
  })
  if (issues.length) throw new ConfigError(issues)
  bundle.request.media = media.filter((entry) => entry !== undefined)
  return bundle
}

export async function applyConfig(
  api: string,
  token: string,
  bundle: ConfigBundle,
  options: { dryRun?: boolean; host?: string } = {},
) {
  const body = JSON.stringify({ ...bundle.request, dry_run: options.dryRun ?? false, host: options.host })
  const send = () => request<ApplyResponse>(`${api}${API_BASE}/apply`, { method: "POST", token, body })
  const first = await send()
  if (!first.missing_media.length || options.dryRun) return first
  const app = encodeURIComponent(first.app)
  await mapLimit(first.missing_media, UPLOAD_CONCURRENCY, async (sha256) => {
    const bytes = await readFile(bundle.files.get(sha256)!)
    await request(`${api}${API_BASE}/apply/media/${sha256}?app=${app}`, {
      method: "PUT",
      token,
      body: bytes,
      headers: { "content-length": String(bytes.length) },
    })
  })
  return send()
}
