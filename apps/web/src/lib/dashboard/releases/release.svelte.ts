import type { ReleaseDetail, ReleaseSummary } from "@schelf/protocol"
import { endpoints } from "../api/endpoints.ts"
import { resource } from "../api/resource.svelte.ts"

export function releaseDetail(appId: string, releaseId: string) {
  return resource<ReleaseDetail>(endpoints.release(appId, releaseId))
}

export function previousShipped(releases: ReleaseSummary[], releaseId: string) {
  const index = releases.findIndex((release) => release.id === releaseId)
  return (
    releases.slice(index + 1).find((release) => release.status === "live" || release.status === "rolling-out")
      ?.version ?? null
  )
}
