import { openAsBlob } from "node:fs"
import {
  API_BASE,
  type CompleteResponse,
  type PublishRequest,
  type PublishResponse,
  type UploadResponse,
  type UploadTarget,
} from "@schelf/protocol"
import type { InferredArtifact } from "./artifacts.ts"
import { digest, mapLimit } from "./files.ts"
import { request } from "./http.ts"

export interface ReleaseInput {
  api: string
  token: string
  version: string
  channel?: string
  bridge?: boolean
  commit?: string
  schelfToml: string
  permissionsToml?: string
  listingToml?: string
  notes: string
  artifacts: HashedArtifact[]
}

export interface HashedArtifact extends InferredArtifact {
  size: number
  sha256: string
}

export interface PublishEvent {
  type: "uploaded"
  name: string
  done: number
  total: number
}

const UPLOAD_CONCURRENCY = 4

interface Part {
  target: UploadTarget
  path: string
  number: number
}

function partsOf(target: UploadTarget, path: string): Part[] {
  return Array.from({ length: target.parts }, (_, index) => ({ target, path, number: index + 1 }))
}

async function uploadPart(api: string, token: string, { target, path, number }: Part) {
  const blob = await openAsBlob(path)
  const url = new URL(target.url, api)
  let body: Blob = blob
  if (target.parts > 1) {
    url.searchParams.set("part", String(number))
    url.searchParams.set("parts", String(target.parts))
    body = blob.slice((number - 1) * target.part_size, number * target.part_size)
  }
  return request<UploadResponse>(url.href, { method: "PUT", token, body })
}

export function hashArtifacts(artifacts: InferredArtifact[]): Promise<HashedArtifact[]> {
  return mapLimit(artifacts, UPLOAD_CONCURRENCY, async (artifact) => ({
    ...artifact,
    ...(await digest(artifact.path)),
  }))
}

export async function publishRelease(input: ReleaseInput, onEvent: (event: PublishEvent) => void = () => {}) {
  const body: PublishRequest = {
    version: input.version,
    commit: input.commit,
    schelf_toml: input.schelfToml,
    permissions_toml: input.permissionsToml,
    listing_toml: input.listingToml,
    notes: input.notes,
    channel: input.channel,
    bridge: input.bridge ?? false,
    files: input.artifacts.map((artifact) => ({
      name: artifact.name,
      platform: artifact.platform,
      kind: artifact.kind,
      size: artifact.size,
      sha256: artifact.sha256,
      executable: artifact.executable,
      signature: artifact.signature,
      blockmap: artifact.blockmap,
    })),
  }
  const release = await request<PublishResponse>(`${input.api}${API_BASE}/publish`, {
    method: "POST",
    token: input.token,
    body: JSON.stringify(body),
  })

  const pathOf = new Map(input.artifacts.map((artifact) => [artifact.name, artifact.path]))
  const parts = release.files.flatMap((target) => partsOf(target, pathOf.get(target.name)!))
  let done = 0
  await mapLimit(parts, UPLOAD_CONCURRENCY, async (part) => {
    await uploadPart(input.api, release.upload_token, part)
    onEvent({ type: "uploaded", name: part.target.name, done: ++done, total: parts.length })
  })

  const completed = await request<CompleteResponse>(
    `${input.api}${API_BASE}/publish/${encodeURIComponent(release.release)}/complete`,
    { method: "POST", token: release.upload_token },
  )
  return { release, completed }
}
