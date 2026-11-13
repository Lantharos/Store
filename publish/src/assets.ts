import { mkdir, open, readFile } from "node:fs/promises"
import { join, matchesGlob } from "node:path"
import * as core from "@actions/core"

interface Asset {
  name: string
  url: string
  state: "uploaded" | "open" | "starter"
}

const POLL_SECONDS = 15
const WAIT_MINUTES = 30

const api = process.env.GITHUB_API_URL ?? "https://api.github.com"

export async function releaseTag(): Promise<string | undefined> {
  const event = process.env.GITHUB_EVENT_PATH
  const release = event
    ? (JSON.parse(await readFile(event, "utf8")) as { release?: { tag_name?: string } }).release
    : undefined
  const ref = process.env.GITHUB_REF ?? ""
  return release?.tag_name ?? (ref.startsWith("refs/tags/") ? ref.slice("refs/tags/".length) : undefined)
}

async function github<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`)
  return (await response.json()) as T
}

async function matchingAssets(tag: string, patterns: string[], token: string) {
  const repository = process.env.GITHUB_REPOSITORY
  const release = await github<{ assets: Asset[] }>(
    `/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    token,
  )
  return release.assets.filter((asset) =>
    patterns.some((pattern) => matchesGlob(asset.name.replace(/\.blockmap$/i, ""), pattern)),
  )
}

async function settledAssets(tag: string, patterns: string[], token: string) {
  const deadline = Date.now() + WAIT_MINUTES * 60_000
  for (;;) {
    const assets = await matchingAssets(tag, patterns, token)
    if (assets.length && assets.every((asset) => asset.state === "uploaded")) return assets
    if (Date.now() > deadline) {
      throw new Error(
        `Release ${tag} has no finished assets matching ${patterns.join(", ")} after ${WAIT_MINUTES} minutes`,
      )
    }
    core.info(`Waiting for the release's assets matching ${patterns.join(", ")}`)
    await new Promise((resolve) => setTimeout(resolve, POLL_SECONDS * 1000))
  }
}

export async function downloadReleaseAssets(tag: string, patterns: string[], token: string) {
  const assets = await settledAssets(tag, patterns, token)
  const directory = join(process.env.RUNNER_TEMP ?? ".", "schelf-release-assets")
  await mkdir(directory, { recursive: true })
  await Promise.all(
    assets.map(async (asset) => {
      const response = await fetch(asset.url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/octet-stream" },
      })
      if (!response.ok || !response.body)
        throw new Error(`Couldn't download ${asset.name} (${response.status})`)
      const file = await open(join(directory, asset.name), "w")
      try {
        for await (const chunk of response.body) await file.write(chunk)
      } finally {
        await file.close()
      }
    }),
  )
  return assets.map((asset) => join(directory, asset.name))
}
